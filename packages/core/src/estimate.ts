import { normalizeToPerToken } from './normalize.js';
import { add, clampNonNegative, exact, mul, order, scale, ZERO } from './range.js';
import { getModel, getRegion, resolveModel, selectBenchmark } from './resolve.js';
import type {
  BenchmarkRow,
  Estimate,
  EstimateFlag,
  EstimateOptions,
  Model,
  Range,
  Region,
  Source,
  TokenCounts,
  UsageEvent,
} from './types.js';

/**
 * Turns one exchange into energy, water and carbon.
 *
 * The one rule that governs every branch below: when we do not know something,
 * the result is null and a flag says why. Nothing here has a path that turns a
 * missing value into a zero and carries on.
 */

/** An estimate with no numbers, which is what an unknown model produces. */
const unknownEstimate = (
  event: UsageEvent,
  datasetVersion: string,
  regionCode: string,
  flags: EstimateFlag[],
  thinkingHandling: Estimate['basis']['thinkingHandling'],
  modelId: string | null = null,
): Estimate => ({
  eventId: event.id,
  modelId,
  datasetVersion,
  energyWh: null,
  waterMl: null,
  carbonG: null,
  basis: {
    benchmarkRowId: null,
    benchmarkParentId: null,
    methodology: null,
    boundary: null,
    regionCode,
    tokens: event.tokens,
    thinkingHandling,
    thinkingTokens: null,
    waterScope: 'on-site + off-site',
    carbonBasis: 'location-based',
    qualityScore: null,
    flags,
    sources: [],
  },
});

/**
 * Works out how many thinking tokens to charge.
 *
 * A reported count is used as it stands. An undisclosed count on a model that
 * can think becomes a range from zero to the model's high ratio, flagged, so the
 * interface can render it as a lower bound. A model that cannot think charges
 * nothing, and that is the only case where zero is the right answer.
 */
const thinkingTokensFor = (
  tokens: TokenCounts,
  model: Model,
  visibleOutput: number,
): { range: Range; handling: Estimate['basis']['thinkingHandling']; flag: EstimateFlag | null } => {
  if (typeof tokens.thinking === 'number') {
    return { range: exact(tokens.thinking), handling: 'reported', flag: null };
  }
  if (tokens.thinking === null && model.reasoning && model.thinkingRatio) {
    return {
      range: {
        low: 0,
        central: visibleOutput * model.thinkingRatio.central,
        high: visibleOutput * model.thinkingRatio.high,
      },
      handling: 'estimated',
      flag: 'thinking-unknown',
    };
  }
  if (tokens.thinking === null && model.reasoning) {
    // The model can think, we have no ratio, and we refuse to invent one.
    return { range: exact(0), handling: 'unknown-model', flag: 'thinking-unknown' };
  }
  return { range: ZERO, handling: 'not-applicable', flag: null };
};

const collectSources = (row: BenchmarkRow, parent: BenchmarkRow | null, region: Region): Source[] => {
  const sources: Source[] = [row.source];
  if (parent && parent.source.url !== row.source.url) sources.push(parent.source);
  sources.push(region.source);
  if (region.waterSource && region.waterSource.url !== region.source.url) {
    sources.push(region.waterSource);
  }
  return sources;
};

export const estimate = (event: UsageEvent, options: EstimateOptions): Estimate => {
  const { dataset } = options;
  const calibration = dataset.calibration;
  const waterScope = options.waterScope ?? 'on-site + off-site';
  const carbonBasis = options.carbonBasis ?? 'location-based';
  const at = options.at ?? event.timestamp.slice(0, 10);

  const flags: EstimateFlag[] = [];

  const requestedRegion = options.regionCode ?? event.regionHint;
  let region = getRegion(dataset, requestedRegion);
  if (!region) {
    region = getRegion(dataset, dataset.defaultRegion);
    flags.push('region-default');
  }
  if (!region) throw new Error(`Dataset has no default region "${dataset.defaultRegion}"`);
  const regionCode = region.code;

  const model = getModel(event.modelId, dataset) ?? resolveModel(event.modelRaw, dataset);
  if (!model) {
    return unknownEstimate(event, dataset.version, regionCode, [...flags, 'model-unknown'], 'unknown-model');
  }

  const row = selectBenchmark(model, dataset, { at, hosting: event.hosting });
  if (!row) {
    return unknownEstimate(
      event,
      dataset.version,
      regionCode,
      [...flags, 'no-benchmark'],
      'unknown-model',
      model.id,
    );
  }
  if (event.hosting === 'local' && row.pue.high > 1) flags.push('local-row-missing');

  const parent = row.proxyOf
    ? (dataset.benchmarks.find((candidate) => candidate.id === row.proxyOf) ?? null)
    : null;

  if (event.tokens.estimated) flags.push('tokens-estimated');

  // ------------------------------------------------------------------ tokens

  const visibleOutput = (event.tokens.output ?? 0) + (event.tokens.tool ?? 0);
  const thinking = thinkingTokensFor(event.tokens, model, event.tokens.output ?? 0);
  if (thinking.flag) flags.push(thinking.flag);
  const outputTokens = order(add(exact(visibleOutput), thinking.range));

  const hidden = calibration.hiddenContextFactor[event.surface] ?? exact(1);
  if (hidden.high > 1) flags.push('input-partial');
  if (event.tokens.input === undefined && event.tokens.output !== undefined) {
    if (!flags.includes('input-partial')) flags.push('input-partial');
  }

  const countedInput = event.tokens.input ?? 0;
  const cachedRead = event.tokens.cachedRead ?? 0;
  const cachedWrite = event.tokens.cachedWrite ?? 0;

  // A cache hit still moves the tokens through the model's attention, but nobody
  // publishes what it costs. The low bound assumes free, the high bound assumes half.
  const cacheShare = calibration.cachedReadShareOfInput;
  const writeShare = calibration.cacheWriteShareOfInput;
  const inputTokens = order(
    add(
      add(mul(exact(countedInput), hidden), scale(cacheShare, cachedRead)),
      scale(writeShare, cachedWrite),
    ),
  );

  // ------------------------------------------------------------------ energy

  const rates = normalizeToPerToken(row, { dataset, model, calibration });

  let energyWh: Range | null = null;
  if (rates) {
    for (const flag of rates.flags) if (!flags.includes(flag)) flags.push(flag);
    const raw = add(add(rates.interceptWh, mul(rates.inputWh, inputTokens)), mul(rates.outputWh, outputTokens));
    const withOverhead = row.energyIncludesPue ? raw : mul(raw, row.pue);
    energyWh = clampNonNegative(order(withOverhead));
  } else {
    flags.push('no-energy-figure');
  }

  const energyKwh = energyWh ? scale(energyWh, 1 / 1000) : null;

  // ------------------------------------------------------------------- scale

  /**
   * How much bigger this exchange is than the one the row describes. Only used
   * for rows that publish water or carbon directly and so cannot be scaled by
   * energy.
   */
  const directScale = (): Range => {
    const perPrompt = row.perPrompt;
    if (!perPrompt) return exact(1);
    const k = calibration.outputToInputEnergyWeight.central;
    const referenceWork = perPrompt.referenceInputTokens.central + k * perPrompt.referenceOutputTokens.central;
    if (referenceWork <= 0) return exact(1);
    const work = order({
      low: inputTokens.low + k * outputTokens.low,
      central: inputTokens.central + k * outputTokens.central,
      high: inputTokens.high + k * outputTokens.high,
    });
    return scale(work, 1 / referenceWork);
  };

  // ------------------------------------------------------------------- water

  let waterMl: Range | null = null;
  const directWater = row.perPrompt?.directWaterMl;
  if (directWater) {
    waterMl = clampNonNegative(order(mul(directWater, directScale())));
    if (!flags.includes('scaled-direct-figure')) flags.push('scaled-direct-figure');
  } else if (energyKwh) {
    // Litres per kilowatt hour, times kilowatt hours, times a thousand for millilitres.
    const onsite = row.waterOnsiteLPerKwh ?? ZERO;
    let litres = mul(energyKwh, onsite);
    if (waterScope !== 'on-site') {
      litres = add(litres, mul(energyKwh, region.waterOffsiteLPerKwh));
    }
    waterMl = clampNonNegative(order(scale(litres, 1000)));
    if (waterScope === 'lifecycle' && row.embodiedShareOfTotal && options.includeEmbodied !== false) {
      const uplift: Range = {
        low: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.low),
        central: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.central),
        high: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.high),
      };
      waterMl = order(mul(waterMl, uplift));
    }
  }

  // ------------------------------------------------------------------ carbon

  let carbonG: Range | null = null;
  const directCarbon = row.perPrompt?.directCarbonG;
  if (directCarbon) {
    carbonG = clampNonNegative(order(mul(directCarbon, directScale())));
    if (!flags.includes('scaled-direct-figure')) flags.push('scaled-direct-figure');
  } else if (energyKwh) {
    // Location-based by default. A provider's market-based factor is a claim about
    // what it bought, not about the electrons it burned, and it flatters the number
    // by three or four times, so it is opt in.
    const intensity =
      carbonBasis === 'provider-reported' && row.carbonGPerKwh ? row.carbonGPerKwh : region.gridGco2PerKwh;
    carbonG = clampNonNegative(order(mul(energyKwh, intensity)));
    if (waterScope === 'lifecycle' && row.embodiedShareOfTotal && options.includeEmbodied !== false) {
      const uplift: Range = {
        low: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.low),
        central: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.central),
        high: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.high),
      };
      carbonG = order(mul(carbonG, uplift));
    }
  }

  return {
    eventId: event.id,
    modelId: model.id,
    datasetVersion: dataset.version,
    energyWh,
    waterMl,
    carbonG,
    basis: {
      benchmarkRowId: row.id,
      benchmarkParentId: parent?.id ?? null,
      methodology: row.methodology,
      boundary: row.boundary,
      regionCode,
      tokens: event.tokens,
      thinkingHandling: thinking.handling,
      thinkingTokens: thinking.handling === 'not-applicable' ? null : thinking.range,
      waterScope,
      carbonBasis,
      qualityScore: row.qualityScore,
      flags,
      sources: collectSources(row, parent, region),
    },
  };
};
