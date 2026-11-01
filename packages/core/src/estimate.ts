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
  WaterScope,
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
 * A row whose measurement already ran the model's reasoning charges none on
 * top: the thinking is inside its per token rate. A count that already holds
 * the thinking, as Anthropic's output count does, charges none on top either.
 * Otherwise a reported count is used as it stands. An undisclosed count on a
 * model that can think becomes a range from zero to the model's high ratio,
 * flagged, so the interface can render it as a lower bound. A model that cannot
 * think charges nothing, and that is the only case where zero is the right
 * answer.
 */
const thinkingTokensFor = (
  tokens: TokenCounts,
  model: Model,
  visibleOutput: number,
  rowIncludesThinking: boolean,
): { range: Range; handling: Estimate['basis']['thinkingHandling']; flag: EstimateFlag | null } => {
  if (rowIncludesThinking && model.reasoning) {
    return { range: ZERO, handling: 'included-in-row', flag: null };
  }
  if (tokens.thinkingInOutput === true) {
    return typeof tokens.thinking === 'number'
      ? { range: exact(tokens.thinking), handling: 'reported', flag: null }
      : { range: ZERO, handling: 'included-in-output', flag: null };
  }
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

/** Narrowest first, so a scope can be compared with the one a figure was published at. */
const SCOPE_RANK: Record<WaterScope, number> = { 'on-site': 0, 'on-site + off-site': 1, lifecycle: 2 };

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
  // Rows say where they were measured. The facility overhead used to stand in
  // for that, and missed the Mistral assessment, whose PUE is one only because
  // it publishes no energy.
  if (event.hosting === 'local' && (row.hosting ?? 'cloud') !== 'local') flags.push('local-row-missing');

  const parent = row.proxyOf
    ? (dataset.benchmarks.find((candidate) => candidate.id === row.proxyOf) ?? null)
    : null;

  if (event.tokens.estimated) flags.push('tokens-estimated');

  // ------------------------------------------------------------------ tokens

  /*
   * When the output count already holds a reported thinking count, the visible
   * part is the difference, so the thinking is charged once and only once.
   */
  const reportedInside =
    event.tokens.thinkingInOutput === true && typeof event.tokens.thinking === 'number'
      ? Math.min(event.tokens.thinking, event.tokens.output ?? 0)
      : 0;
  const visibleOutput = (event.tokens.output ?? 0) - reportedInside + (event.tokens.tool ?? 0);
  const rowIncludesThinking = row.includesThinking ?? parent?.includesThinking ?? false;
  const thinking = thinkingTokensFor(
    event.tokens,
    model,
    (event.tokens.output ?? 0) - reportedInside,
    rowIncludesThinking,
  );
  if (thinking.flag) flags.push(thinking.flag);
  const outputTokens = order(add(exact(visibleOutput), thinking.range));

  const hidden = calibration.hiddenContextFactor[event.surface] ?? exact(1);
  if (hidden.high > 1) flags.push('input-partial');
  if (event.tokens.input === undefined && event.tokens.output !== undefined) {
    if (!flags.includes('input-partial')) flags.push('input-partial');
  }
  // An image or a file we couldn't read is input we didn't count, so the
  // input is a lower bound for a reason the system prompt doesn't cover.
  if (event.tokens.attachmentsUncounted) flags.push('attachments-uncounted');

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
  /** The energy drawn by the servers alone, before facility overhead. On-site water is charged on this. */
  let itEnergyWh: Range | null = null;
  if (rates) {
    for (const flag of rates.flags) if (!flags.includes(flag)) flags.push(flag);
    const raw = add(add(rates.interceptWh, mul(rates.inputWh, inputTokens)), mul(rates.outputWh, outputTokens));
    const withOverhead = row.energyIncludesPue ? raw : mul(raw, row.pue);
    energyWh = clampNonNegative(order(withOverhead));
    // Bound by bound, because the overhead in the total is the same overhead taken out here.
    itEnergyWh = row.energyIncludesPue
      ? clampNonNegative(
          order({
            low: raw.low / row.pue.low,
            central: raw.central / row.pue.central,
            high: raw.high / row.pue.high,
          }),
        )
      : clampNonNegative(order(raw));
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

  // ------------------------------------------------------------------- scope

  /*
   * A figure published at one scope can be widened by adding what it leaves
   * out, where we can work that out, but it cannot be narrowed: nobody can take
   * the on-site part back out of a lifecycle total. Making the hardware is
   * added from the row's embodied share. Without one, a lifecycle figure is
   * the running figure and no more, so it is flagged as a lower bound.
   */
  const directScope = row.perPrompt?.directScope ?? 'lifecycle';
  const wantsEmbodied = waterScope === 'lifecycle';
  const embodiedUplift: Range | null =
    wantsEmbodied && row.embodiedShareOfTotal && options.includeEmbodied !== false
      ? {
          low: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.low),
          central: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.central),
          high: 1 / Math.max(1e-9, 1 - row.embodiedShareOfTotal.high),
        }
      : null;
  let embodiedMissing = false;
  const flagOnce = (flag: EstimateFlag): void => {
    if (!flags.includes(flag)) flags.push(flag);
  };
  /** Adds making the hardware to a running figure, or marks it a lower bound. */
  const withEmbodied = (running: Range): Range => {
    if (!wantsEmbodied) return running;
    if (embodiedUplift) return order(mul(running, embodiedUplift));
    embodiedMissing = true;
    return running;
  };

  // ------------------------------------------------------------------- water

  let waterMl: Range | null = null;
  const directWater = row.perPrompt?.directWaterMl;
  if (directWater) {
    if (SCOPE_RANK[waterScope] < SCOPE_RANK[directScope]) {
      flagOnce('direct-scope-wider');
    } else {
      flagOnce('scaled-direct-figure');
      const published = clampNonNegative(order(mul(directWater, directScale())));
      if (directScope === 'lifecycle') {
        waterMl = published;
      } else if (directScope === 'on-site' && waterScope !== 'on-site') {
        // The power station's water follows the electricity, so it needs the
        // energy. Without it the wider figure is unknown, not the narrow one.
        if (energyKwh) {
          const offSite = scale(mul(energyKwh, region.waterOffsiteLPerKwh), 1000);
          waterMl = withEmbodied(clampNonNegative(order(add(published, offSite))));
        }
      } else {
        waterMl = withEmbodied(published);
      }
    }
  } else if (energyKwh && itEnergyWh && row.waterOnsiteLPerKwh) {
    // Litres per kilowatt hour, times kilowatt hours, times a thousand for millilitres.
    // WUE is defined against the servers' energy, so on-site water is charged on that,
    // and off-site water, which follows the electricity, on the whole draw.
    let litres = mul(scale(itEnergyWh, 1 / 1000), row.waterOnsiteLPerKwh);
    if (waterScope !== 'on-site') {
      litres = add(litres, mul(energyKwh, region.waterOffsiteLPerKwh));
    }
    waterMl = withEmbodied(clampNonNegative(order(scale(litres, 1000))));
  }
  // Energy known and water not, for no reason already given: the row has no
  // water figure. Said, so a total over such turns reads as a lower bound.
  if (waterMl === null && energyKwh && !flags.includes('direct-scope-wider')) {
    flagOnce('no-water-figure');
  }

  // ------------------------------------------------------------------ carbon

  let carbonG: Range | null = null;
  // What the carbon figure actually rests on. A provider's own factor exists
  // for few rows, and where it doesn't the grid is used and the basis says so.
  let carbonBasisUsed = carbonBasis;
  const directCarbon = row.perPrompt?.directCarbonG;
  if (directCarbon) {
    // Carbon has two scopes, running and lifecycle, since the grid is always counted.
    if (directScope === 'lifecycle' && !wantsEmbodied) {
      flagOnce('direct-scope-wider');
    } else {
      flagOnce('scaled-direct-figure');
      const published = clampNonNegative(order(mul(directCarbon, directScale())));
      carbonG = directScope === 'lifecycle' ? published : withEmbodied(published);
    }
  } else if (energyKwh) {
    // Location-based by default. A provider's market-based factor is a claim about
    // what it bought, not about the electrons it burned, and it flatters the number
    // by three or four times, so it is opt in.
    const provider = carbonBasis === 'provider-reported' && row.carbonGPerKwh ? row.carbonGPerKwh : null;
    if (!provider) carbonBasisUsed = 'location-based';
    carbonG = withEmbodied(clampNonNegative(order(mul(energyKwh, provider ?? region.gridGco2PerKwh))));
  }

  if (embodiedMissing) flagOnce('embodied-missing');

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
      thinkingTokens:
        thinking.handling === 'not-applicable' ||
        thinking.handling === 'included-in-row' ||
        thinking.handling === 'included-in-output'
          ? null
          : thinking.range,
      waterScope,
      carbonBasis: carbonBasisUsed,
      qualityScore: row.qualityScore,
      flags,
      sources: collectSources(row, parent, region),
    },
  };
};
