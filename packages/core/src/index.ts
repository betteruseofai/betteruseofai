/**
 * The estimation engine.
 *
 * Isomorphic on purpose: this package runs unchanged in a browser extension, in
 * a static site, and in a command line tool, so it uses no Node APIs and reads
 * nothing from disk. The dataset is passed in.
 */

export * from './types.js';
export * from './range.js';
export { resolveModel, getModel, getRegion, selectBenchmark, downgradeTarget } from './resolve.js';
export type { SelectOptions } from './resolve.js';
export { normalizeToPerToken, fitQuerySet, ecologitsWhPerOutputToken } from './normalize.js';
export type { PerTokenRates, NormaliseContext } from './normalize.js';
export { estimate } from './estimate.js';
export { aggregate } from './aggregate.js';
export type { AggregateInput } from './aggregate.js';
export { equivalents } from './equivalents.js';
export type { EquivalentResult } from './equivalents.js';
export {
  formatRange,
  displayNumber,
  canonicalNumber,
  roundSignificant,
  explainFlags,
  SIGNIFICANT_DIGITS,
} from './format.js';
export type { FormatRangeOptions } from './format.js';

export {
  createRecommender,
  extractFeatures,
  readArithmetic,
  readUnitConversion,
  DEFAULT_RULES,
  DEFAULT_HINT_THRESHOLD,
  DEFAULT_REPORT_THRESHOLD,
  VETO_THRESHOLD,
} from './recommender/index.js';
export type {
  Recommender,
  Recommendation,
  RecommenderOptions,
  RecommendInput,
  Rule,
  RuleContext,
  RuleKind,
  RuleResult,
  Savings,
  Features,
  Arithmetic,
  UnitConversion,
  FeatureInput,
} from './recommender/index.js';

import type { Dataset } from './types.js';

/** Reads the dataset version out of a bundle, for display in a meta strip. */
export const datasetVersionOf = (dataset: Dataset): string => dataset.version;
