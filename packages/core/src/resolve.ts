import type { BenchmarkRow, Dataset, Model } from './types.js';

/**
 * Turns whatever string a surface gave us into a model, or into null.
 *
 * There is no fuzzy matching and no prefix guessing here on purpose. A wrong
 * match produces a confident number for the wrong model, which is worse than
 * saying we do not know. Unrecognised strings come back as null and render as
 * "unknown".
 */

const normalise = (raw: string): string => raw.trim().toLowerCase();

const indexes = new WeakMap<Dataset, Map<string, Model>>();

const aliasIndex = (dataset: Dataset): Map<string, Model> => {
  let index = indexes.get(dataset);
  if (index) return index;
  index = new Map<string, Model>();
  for (const model of dataset.models) {
    index.set(normalise(model.id), model);
    for (const alias of model.aliases) index.set(normalise(alias), model);
  }
  indexes.set(dataset, index);
  return index;
};

export const resolveModel = (raw: string | null | undefined, dataset: Dataset): Model | null => {
  if (!raw) return null;
  const key = normalise(raw);
  // Claude Code writes this for messages it generated without calling a model.
  if (key === '<synthetic>' || key === 'synthetic') return null;
  return aliasIndex(dataset).get(key) ?? null;
};

export const getModel = (id: string | null | undefined, dataset: Dataset): Model | null =>
  id ? (dataset.models.find((model) => model.id === id) ?? null) : null;

/** The next rung down the same ladder, or null when this model is already the bottom. */
export const downgradeTarget = (model: Model, dataset: Dataset): Model | null =>
  dataset.models.find(
    (candidate) =>
      candidate.family === model.family &&
      candidate.ordinal === model.ordinal + 1 &&
      candidate.deprecated === undefined,
  ) ?? null;

/** Rows that model tokens explicitly are more useful than rows that quote one figure. */
const SHAPE_RANK: Record<BenchmarkRow['shape'], number> = {
  'per-query-set': 0,
  'per-token': 1,
  parametric: 2,
  'per-prompt': 3,
  proxy: 4,
};

const METHODOLOGY_RANK: Record<BenchmarkRow['methodology'], number> = {
  'provider-measured': 0,
  'independent-benchmark': 1,
  'provider-statement': 2,
  'parametric-model': 3,
  proxy: 4,
};

export interface SelectOptions {
  /** ISO date used to skip rows that had not been published yet or have expired. */
  at?: string;
  /** A model on the user's own machine must not be costed from a data centre row. */
  hosting?: 'cloud' | 'local';
}

/**
 * Picks the row to estimate from.
 *
 * Order: quality first, then rows that model token scaling, then measurement over
 * formula over guess, then the most recent. The final tiebreak is the row id, so
 * the choice is deterministic and the TypeScript and Python implementations agree.
 */
export const selectBenchmark = (
  model: Model,
  dataset: Dataset,
  options: SelectOptions = {},
): BenchmarkRow | null => {
  const at = options.at;
  let candidates = dataset.benchmarks.filter((row) => {
    if (!row.modelIds.includes(model.id)) return false;
    if (at && row.validFrom > at) return false;
    if (at && row.validTo && row.validTo < at) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Rows say which they describe. Inferring it from the facility overhead would
  // mislabel a row such as the Mistral assessment, which carries a PUE of one
  // only because it publishes no energy figure at all.
  const wanted = options.hosting ?? 'cloud';
  const matching = candidates.filter((row) => (row.hosting ?? 'cloud') === wanted);
  if (matching.length > 0) candidates = matching;

  const sorted = [...candidates].sort((a, b) => {
    if (a.qualityScore !== b.qualityScore) return b.qualityScore - a.qualityScore;
    if (SHAPE_RANK[a.shape] !== SHAPE_RANK[b.shape]) return SHAPE_RANK[a.shape] - SHAPE_RANK[b.shape];
    if (METHODOLOGY_RANK[a.methodology] !== METHODOLOGY_RANK[b.methodology]) {
      return METHODOLOGY_RANK[a.methodology] - METHODOLOGY_RANK[b.methodology];
    }
    if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  });

  return sorted[0] ?? null;
};

export const getRegion = (dataset: Dataset, code: string | undefined) =>
  dataset.regions.find((region) => region.code === code) ?? null;
