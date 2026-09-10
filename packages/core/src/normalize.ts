import { clampNonNegative, exact, mul, order, scale, ZERO } from './range.js';
import type { BenchmarkRow, Calibration, Dataset, EstimateFlag, Model, Range } from './types.js';

/**
 * Turns any benchmark shape into one common form: a fixed cost per exchange plus
 * a rate per input token and a rate per output token, all in watt hours.
 *
 * Where the conversion loses information it says so with a flag, and it widens
 * the range rather than pretending the derived number is as good as a measured
 * one.
 */
export interface PerTokenRates {
  /** Charged once per exchange. Non-zero only for fitted rows with an intercept. */
  interceptWh: Range;
  inputWh: Range;
  outputWh: Range;
  flags: EstimateFlag[];
  /** The row the rates ultimately came from, following any proxy. */
  rootRowId: string;
}

const widen = (rate: Range, factor: Range): Range =>
  order({
    low: rate.low * factor.low,
    central: rate.central * factor.central,
    high: rate.high * factor.high,
  });

/**
 * Least squares fit of wh = a + bIn * input + bOut * output.
 *
 * Some published sets are not monotonic, which can produce a negative
 * coefficient. A negative rate would mean a longer prompt costs less, so when
 * one appears we drop that term and refit on the rest rather than clamping a
 * broken fit.
 */
export const fitQuerySet = (
  points: Array<{ inputTokens: number; outputTokens: number; energyWh: number }>,
  outputToInputWeight = 8,
): { intercept: number; inputWh: number; outputWh: number } => {
  const columns = ['intercept', 'input', 'output'] as const;
  type Column = (typeof columns)[number];

  const valueOf = (column: Column, point: (typeof points)[number]): number =>
    column === 'intercept' ? 1 : column === 'input' ? point.inputTokens : point.outputTokens;

  const solveFor = (active: Column[]): Record<Column, number> | null => {
    const n = active.length;
    // Normal equations, with a small ridge term so a rank-deficient set still solves.
    const ata: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        let total = i === j ? 1e-12 : 0;
        for (const point of points) {
          const ai = active[i];
          const aj = active[j];
          if (ai === undefined || aj === undefined) continue;
          total += valueOf(ai, point) * valueOf(aj, point);
        }
        return total;
      }),
    );
    const atb: number[] = Array.from({ length: n }, (_, i) => {
      let total = 0;
      for (const point of points) {
        const ai = active[i];
        if (ai === undefined) continue;
        total += valueOf(ai, point) * point.energyWh;
      }
      return total;
    });

    // Gaussian elimination with partial pivoting.
    for (let col = 0; col < n; col += 1) {
      let pivot = col;
      for (let row = col + 1; row < n; row += 1) {
        if (Math.abs(ata[row]?.[col] ?? 0) > Math.abs(ata[pivot]?.[col] ?? 0)) pivot = row;
      }
      if (Math.abs(ata[pivot]?.[col] ?? 0) < 1e-15) return null;
      [ata[col], ata[pivot]] = [ata[pivot] as number[], ata[col] as number[]];
      [atb[col], atb[pivot]] = [atb[pivot] as number, atb[col] as number];

      for (let row = col + 1; row < n; row += 1) {
        const factor = (ata[row]?.[col] ?? 0) / (ata[col]?.[col] ?? 1);
        if (factor === 0) continue;
        for (let k = col; k < n; k += 1) {
          (ata[row] as number[])[k] = (ata[row]?.[k] ?? 0) - factor * (ata[col]?.[k] ?? 0);
        }
        atb[row] = (atb[row] ?? 0) - factor * (atb[col] ?? 0);
      }
    }

    const solution = new Array<number>(n).fill(0);
    for (let row = n - 1; row >= 0; row -= 1) {
      let value = atb[row] ?? 0;
      for (let col = row + 1; col < n; col += 1) {
        value -= (ata[row]?.[col] ?? 0) * (solution[col] ?? 0);
      }
      solution[row] = value / (ata[row]?.[row] ?? 1);
    }

    const result = { intercept: 0, input: 0, output: 0 } as Record<Column, number>;
    active.forEach((column, index) => {
      result[column] = solution[index] ?? 0;
    });
    return result;
  };

  // A column that never varies cannot be told apart from the intercept. Epoch, for
  // instance, held output at 500 tokens and varied only the context, so a plain fit
  // reports that an output token is free. Fit without the constant column, then hand
  // the whole intercept to it: attributing the fixed cost to the tokens we know were
  // there beats declaring them weightless.
  const constantColumn = (['input', 'output'] as const).find((column) => {
    const values = points.map((point) => valueOf(column, point));
    const first = values[0] ?? 0;
    return first > 0 && values.every((value) => value === first);
  });
  const varyingColumn = (['input', 'output'] as const).find((column) => {
    const values = points.map((point) => valueOf(column, point));
    return new Set(values).size > 1;
  });

  if (constantColumn && varyingColumn) {
    const solvedPair = solveFor(['intercept', varyingColumn]);
    if (solvedPair) {
      const constantValue = valueOf(constantColumn, points[0] as (typeof points)[number]);
      const varyingRate = Math.max(0, solvedPair[varyingColumn]);
      let perConstantToken = Math.max(0, solvedPair.intercept) / constantValue;

      if (perConstantToken <= 0) {
        // The intercept came out at or below zero, so the constant column carries
        // no identifiable cost of its own. Rather than declare those tokens free,
        // price them off the column we could measure, using the same output to
        // input weight the rest of the engine uses.
        perConstantToken =
          constantColumn === 'output'
            ? varyingRate * outputToInputWeight
            : varyingRate / outputToInputWeight;
      }

      const result = { intercept: 0, inputWh: 0, outputWh: 0 };
      result[varyingColumn === 'input' ? 'inputWh' : 'outputWh'] = varyingRate;
      result[constantColumn === 'input' ? 'inputWh' : 'outputWh'] = perConstantToken;
      return result;
    }
  }

  let active: Column[] = [...columns];
  let solved = solveFor(active);

  // Drop negative terms one at a time and refit. Two passes is enough for three columns.
  for (let pass = 0; pass < 2 && solved; pass += 1) {
    const offender = active.find((column) => (solved as Record<Column, number>)[column] < 0);
    if (!offender) break;
    active = active.filter((column) => column !== offender);
    if (active.length === 0) break;
    solved = solveFor(active);
  }

  if (!solved) return { intercept: 0, inputWh: 0, outputWh: 0 };
  return {
    intercept: Math.max(0, solved.intercept),
    inputWh: Math.max(0, solved.input),
    outputWh: Math.max(0, solved.output),
  };
};

/**
 * EcoLogits energy per output token, in watt hours.
 *
 * The published coefficients give kilowatt hours per thousand output tokens for
 * a model with the given active parameter count. The unit convention is not
 * fully pinned down against the reference implementation, which is why every
 * parametric result carries a wide multiplier and the parametric-rate flag, and
 * why a measured row always wins over this one. See the dataset changelog.
 */
export const ecologitsWhPerOutputToken = (
  coefficients: { alphaKwhPerTokenPerB: number; betaPerB: number; gammaKwhPerToken: number },
  activeParamsB: number,
): number => {
  const { alphaKwhPerTokenPerB: alpha, betaPerB: beta, gammaKwhPerToken: gamma } = coefficients;
  const kwhPerThousandTokens = alpha * Math.exp(beta * activeParamsB) * activeParamsB + gamma;
  return (kwhPerThousandTokens * 1000) / 1000;
};

export interface NormaliseContext {
  dataset: Dataset;
  model: Model;
  calibration: Calibration;
}

export const normalizeToPerToken = (
  row: BenchmarkRow,
  context: NormaliseContext,
  seen: Set<string> = new Set(),
): PerTokenRates | null => {
  const { calibration, model, dataset } = context;
  const flags: EstimateFlag[] = [];

  if (seen.has(row.id)) return null;
  seen.add(row.id);

  switch (row.shape) {
    case 'per-token': {
      if (!row.perToken) return null;
      return {
        interceptWh: ZERO,
        inputWh: row.perToken.energyWhPerInputToken,
        outputWh: row.perToken.energyWhPerOutputToken,
        flags,
        rootRowId: row.id,
      };
    }

    case 'per-prompt': {
      const perPrompt = row.perPrompt;
      if (!perPrompt) return null;
      if (!perPrompt.energyWh) {
        // A row that publishes water and carbon but no energy, such as the Mistral
        // assessment. It cannot produce a per token energy rate at all.
        return null;
      }
      // One figure covers input and output together, so we split it using the
      // weight k: an output token is assumed to cost k times an input token.
      const k = calibration.outputToInputEnergyWeight;
      const referenceInput = perPrompt.referenceInputTokens.central;
      const referenceOutput = perPrompt.referenceOutputTokens.central;
      const denominator = referenceInput + k.central * referenceOutput;
      if (denominator <= 0) return null;

      const inputRate: Range = {
        low: perPrompt.energyWh.low / denominator,
        central: perPrompt.energyWh.central / denominator,
        high: perPrompt.energyWh.high / denominator,
      };
      const outputRate = scale(inputRate, k.central);

      flags.push('derived-rate');
      let widening = calibration.derivedRowWidening;
      if (!perPrompt.tokenCountsPublished) {
        flags.push('assumed-token-counts');
        const extra = calibration.assumedTokenCountWidening;
        if (extra) {
          widening = {
            low: widening.low * extra.low,
            central: widening.central * extra.central,
            high: widening.high * extra.high,
          };
        }
      }

      return {
        interceptWh: ZERO,
        inputWh: widen(inputRate, widening),
        outputWh: widen(outputRate, widening),
        flags,
        rootRowId: row.id,
      };
    }

    case 'per-query-set': {
      const set = row.perQuerySet;
      if (!set || set.points.length < 2) return null;
      const fit = fitQuerySet(set.points, calibration.outputToInputEnergyWeight.central);
      const uncertainty = set.relativeUncertainty ?? calibration.derivedRowWidening;
      return {
        interceptWh: widen(exact(fit.intercept), uncertainty),
        inputWh: widen(exact(fit.inputWh), uncertainty),
        outputWh: widen(exact(fit.outputWh), uncertainty),
        flags,
        rootRowId: row.id,
      };
    }

    case 'parametric': {
      const parametric = row.parametric;
      const params = model.activeParamsB;
      if (!parametric || !params) return null;
      const perOutput: Range = {
        low: ecologitsWhPerOutputToken(parametric.coefficients, params.low),
        central: ecologitsWhPerOutputToken(parametric.coefficients, params.central),
        high: ecologitsWhPerOutputToken(parametric.coefficients, params.high),
      };
      const widening = calibration.parametricWidening ?? calibration.derivedRowWidening;
      const output = widen(order(perOutput), widening);
      // An input token is charged at one over the output weight, matching the
      // convention used to split a per prompt figure.
      const k = calibration.outputToInputEnergyWeight;
      const input = order({
        low: output.low / k.high,
        central: output.central / k.central,
        high: output.high / k.low,
      });
      flags.push('parametric-rate');
      return { interceptWh: ZERO, inputWh: input, outputWh: output, flags, rootRowId: row.id };
    }

    case 'proxy': {
      if (!row.proxyOf || !row.proxyFactor) return null;
      const parent = dataset.benchmarks.find((candidate) => candidate.id === row.proxyOf);
      if (!parent) return null;
      // The parent describes a different model, so normalise it against the model
      // it was actually measured on, not the one we are estimating.
      const parentModel =
        dataset.models.find((candidate) => parent.modelIds.includes(candidate.id)) ?? model;
      const base = normalizeToPerToken(parent, { ...context, model: parentModel }, seen);
      if (!base) return null;
      return {
        interceptWh: clampNonNegative(mul(base.interceptWh, row.proxyFactor)),
        inputWh: clampNonNegative(mul(base.inputWh, row.proxyFactor)),
        outputWh: clampNonNegative(mul(base.outputWh, row.proxyFactor)),
        flags: [...base.flags, 'proxy-row'],
        rootRowId: base.rootRowId,
      };
    }

    default:
      return null;
  }
};
