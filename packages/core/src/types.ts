/**
 * Types for the estimation engine.
 *
 * Two conventions run through all of this and neither is negotiable.
 *
 * Every number is a Range. There is no scalar energy figure anywhere, because
 * the published measurements disagree by an order of magnitude and a single
 * number would be a claim we cannot support.
 *
 * Absence is never zero. An unknown model gives null, not 0. An undisclosed
 * thinking count gives a range starting at zero with a flag, not a silent
 * omission. Nothing in this file has a default that rounds a missing value
 * down to nothing.
 */

export interface Range {
  low: number;
  central: number;
  high: number;
}

// ------------------------------------------------------------------ dataset

export type Tier = 'frontier' | 'mid' | 'small' | 'nano';

export type Provider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'mistral'
  | 'meta'
  | 'deepseek'
  | 'alibaba'
  | 'microsoft'
  | 'other';

export interface Model {
  id: string;
  aliases: string[];
  provider: Provider;
  /** The ladder this model sits on. A downgrade moves to ordinal + 1 in the same family. */
  family: string;
  tier: Tier;
  /** Rung on the family ladder. 0 is the largest model in that family. */
  ordinal: number;
  displayName: string;
  /** Whether the model can spend hidden thinking tokens. */
  reasoning: boolean;
  /** Thinking tokens as a multiple of visible output, used when the count is not disclosed. */
  thinkingRatio?: Range;
  activeParamsB?: Range;
  hosting?: 'cloud' | 'local' | 'both';
  released?: string;
  deprecated?: string;
  provenance?: Provenance;
  notes?: string;
}

export type BenchmarkShape = 'per-token' | 'per-prompt' | 'per-query-set' | 'parametric' | 'proxy';

export type Methodology =
  | 'provider-measured'
  | 'provider-statement'
  | 'independent-benchmark'
  | 'parametric-model'
  | 'proxy';

export type Boundary = 'accelerator-only' | 'server' | 'datacenter' | 'lifecycle';

export interface Source {
  title: string;
  url: string;
  publisher: string;
  date: string;
  retrieved: string;
  doi?: string;
  licence?: string;
}

/**
 * How a value reached the repository, so the re-check debt is machine
 * readable rather than a note somebody has to remember. Required by the
 * dataset schema on every record that carries one.
 */
export interface Provenance {
  method: 'source-appendix' | 'recalled-pending-refetch' | 'fetched';
  /** ISO date. */
  recorded: string;
  note?: string;
}

export interface BenchmarkRow {
  id: string;
  modelIds: string[];
  shape: BenchmarkShape;
  perToken?: {
    energyWhPerInputToken: Range;
    energyWhPerOutputToken: Range;
  };
  perPrompt?: {
    energyWh?: Range;
    directWaterMl?: Range;
    directCarbonG?: Range;
    referenceInputTokens: Range;
    referenceOutputTokens: Range;
    tokenCountsPublished: boolean;
  };
  perQuerySet?: {
    points: Array<{ label?: string; inputTokens: number; outputTokens: number; energyWh: number }>;
    relativeUncertainty?: Range;
  };
  parametric?: {
    model: 'ecologits';
    coefficients: {
      alphaKwhPerTokenPerB: number;
      betaPerB: number;
      gammaKwhPerToken: number;
    };
    serverBaseW?: Range;
    gpuCount?: number;
  };
  /** Whether the row describes hosted inference or a model on the user's own machine. */
  hosting?: 'cloud' | 'local';
  pue: Range;
  energyIncludesPue: boolean;
  waterOnsiteLPerKwh?: Range;
  carbonGPerKwh?: Range;
  carbonBasis?: 'market-based' | 'location-based';
  embodiedShareOfTotal?: Range;
  methodology: Methodology;
  boundary: Boundary;
  proxyOf?: string;
  proxyFactor?: Range;
  source: Source;
  validFrom: string;
  validTo?: string;
  qualityScore: number;
  provenance?: Provenance;
  notes?: string;
}

export interface Region {
  code: string;
  name: string;
  kind: 'world' | 'country' | 'subregion' | 'provider-fleet';
  continent?: string;
  gridGco2PerKwh: Range;
  waterOffsiteLPerKwh: Range;
  year: number;
  source: Source;
  waterSource?: Source;
  provenance?: Provenance;
  notes?: string;
}

export interface Equivalent {
  id: string;
  quantity: 'energy' | 'water' | 'carbon';
  unitPer: 'Wh' | 'mL' | 'g';
  amount: number;
  singular: string;
  plural: string;
  stale?: boolean;
  source: Source;
  provenance?: Provenance;
  notes?: string;
}

export interface Calibration {
  version: string;
  tokenizer: {
    baseEncoding: string;
    /** Characters per token, by content class. Measured, not guessed. */
    charsPerTokenFallback?: Record<string, Range>;
    charsPerTokenNotes?: string;
    providers: Record<
      string,
      { exact: boolean; contentClasses: Record<string, Range>; source?: Source; notes?: string }
    >;
  };
  cachedReadShareOfInput: Range;
  cacheWriteShareOfInput: Range;
  outputToInputEnergyWeight: Range;
  derivedRowWidening: Range;
  assumedTokenCountWidening?: Range;
  parametricWidening?: Range;
  hiddenContextFactor: Record<string, Range>;
  localPue?: Range;
}

export interface Dataset {
  version: string;
  sha256: string;
  models: Model[];
  benchmarks: BenchmarkRow[];
  regions: Region[];
  defaultRegion: string;
  equivalents: Equivalent[];
  calibration: Calibration;
}

// -------------------------------------------------------------------- usage

/**
 * Token counts for one exchange.
 *
 * `input` excludes cached reads; readers do that subtraction so the engine never
 * double counts. `thinking` carries three distinct states and they mean different
 * things: a number is a reported count, `null` means the model can think but the
 * count was not disclosed, and `undefined` means the model cannot think at all.
 * Collapsing null into undefined, or either into 0, is the exact failure this
 * project exists to avoid.
 */
export interface TokenCounts {
  input?: number;
  output?: number;
  cachedRead?: number;
  cachedWrite?: number;
  thinking?: number | null;
  tool?: number;
  /** True when any count came from a tokenizer estimate rather than the provider. */
  estimated: boolean;
  /** Which estimator produced the counts, for the tooltip. */
  estimator: string;
}

export type Surface =
  | 'claude-web'
  | 'chatgpt-web'
  | 'gemini-web'
  | 'claude-code'
  | 'codex-cli'
  | 'gemini-cli'
  | 'local-webui'
  | 'api'
  | (string & {});

export interface UsageEvent {
  id: string;
  surface: Surface;
  hosting: 'cloud' | 'local';
  /** Whatever string the surface gave us, kept verbatim so an unknown model can be reported. */
  modelRaw: string;
  /** Resolved id, or null when we do not recognise the model. Never guessed. */
  modelId: string | null;
  tokens: TokenCounts;
  /** ISO 8601, always UTC. */
  timestamp: string;
  conversationId?: string;
  sessionId?: string;
  regionHint?: string;
  /** A hash, never the prompt. Prompt text is not stored anywhere in this system. */
  promptPreviewHash?: string;
  meta?: Record<string, unknown>;
}

// ----------------------------------------------------------------- estimates

export type EstimateFlag =
  /** We do not recognise the model, so there are no numbers at all. */
  | 'model-unknown'
  /** We know the model but have no benchmark row for it. */
  | 'no-benchmark'
  /** Token counts came from a tokenizer, not the provider. */
  | 'tokens-estimated'
  /** The model can think and did not say how much. The low bound assumes none. */
  | 'thinking-unknown'
  /** The row is scaled from another model rather than measured. */
  | 'proxy-row'
  /** No region was given, so the world average was used. */
  | 'region-default'
  /** Input tokens are a lower bound, because the surface hides its system prompt. */
  | 'input-partial'
  /** The per token rate was derived from a per prompt figure rather than measured. */
  | 'derived-rate'
  /** The source did not publish the token counts behind its figure, so we assumed them. */
  | 'assumed-token-counts'
  /** The rate came out of a formula, not a measurement. */
  | 'parametric-rate'
  /** The row publishes water or carbon directly and has no energy figure. */
  | 'no-energy-figure'
  /** Water or carbon was published directly and scaled to this exchange. */
  | 'scaled-direct-figure'
  /** A local model was estimated from a row measured in somebody else's data centre. */
  | 'local-row-missing';

export type WaterScope = 'on-site' | 'on-site + off-site' | 'lifecycle';
export type CarbonBasis = 'location-based' | 'provider-reported';

export interface EstimateBasis {
  benchmarkRowId: string | null;
  /** For a proxy row, the row it was scaled from. */
  benchmarkParentId: string | null;
  methodology: Methodology | null;
  boundary: Boundary | null;
  regionCode: string;
  tokens: TokenCounts;
  /** How the thinking tokens in this estimate were arrived at. */
  thinkingHandling: 'reported' | 'estimated' | 'not-applicable' | 'unknown-model';
  /** Thinking tokens actually charged, as a range when they were not disclosed. */
  thinkingTokens: Range | null;
  waterScope: WaterScope;
  carbonBasis: CarbonBasis;
  qualityScore: number | null;
  flags: EstimateFlag[];
  sources: Source[];
}

export interface Estimate {
  eventId: string;
  modelId: string | null;
  datasetVersion: string;
  /** Null means unknown. It never means zero. */
  energyWh: Range | null;
  waterMl: Range | null;
  carbonG: Range | null;
  basis: EstimateBasis;
}

export interface EstimateOptions {
  dataset: Dataset;
  /** Region code for the grid factors. Falls back to the dataset default with a flag. */
  regionCode?: string;
  waterScope?: WaterScope;
  carbonBasis?: CarbonBasis;
  /** Only meaningful when the row has an embodied share and the scope is lifecycle. */
  includeEmbodied?: boolean;
  /** Date used to pick a benchmark row. Defaults to the event timestamp. */
  at?: string;
}

export type AggregateBucket = 'day' | 'week' | 'model' | 'surface' | 'session' | 'hosting' | 'all';

export interface Aggregate {
  /** The bucket value: a date, a model id, a surface, or "all". */
  key: string;
  bucket: AggregateBucket;
  from: string;
  to: string;
  count: number;
  energyWh: Range | null;
  waterMl: Range | null;
  carbonG: Range | null;
  bySurface: Record<string, number>;
  byHosting: Record<string, number>;
  byModel: Record<string, number>;
  /** Events we could not put a number on. Reported, never folded into the totals as zero. */
  unknownModelCount: number;
  /** Events with a known model but no benchmark row. */
  noBenchmarkCount: number;
  flags: EstimateFlag[];
}
