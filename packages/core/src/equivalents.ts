import type { Dataset, Equivalent } from './types.js';

export interface EquivalentResult {
  id: string;
  count: number;
  label: string;
  stale: boolean;
  source: Equivalent['source'];
  notes?: string;
}

/**
 * Ranking, in two parts, because one blended score kept making odd choices.
 *
 * First a tier, which is a hard preference. A whole number of something beats a
 * fraction of something bigger: nine teaspoons of water is a picture, a fifth
 * of a glass is arithmetic. And a comparison we have marked stale is the last
 * resort, so the seventeen year old search figure only appears when nothing
 * else fits at all.
 *
 * Then, within a tier, distance from one in orders of magnitude.
 */
const tier = (count: number, stale: boolean): number => (stale ? 2 : 0) + (count < 1 ? 1 : 0);

const distance = (count: number): number => Math.abs(Math.log10(count));

/**
 * Picks the everyday comparisons that actually help.
 *
 * A comparison only earns its place when the count lands somewhere a person can
 * picture, so anything below a tenth or above a hundred is dropped. Of what is
 * left we take the two closest to a single unit. If nothing qualifies we return
 * nothing, rather than telling someone their prompt used 0.00002 of a car journey.
 */
export const equivalents = (
  value: number | null,
  quantity: Equivalent['quantity'],
  dataset: Dataset,
  limit = 2,
): EquivalentResult[] => {
  if (value === null || !Number.isFinite(value) || value <= 0) return [];

  const candidates = dataset.equivalents
    .filter((entry) => entry.quantity === quantity)
    .map((entry) => ({ entry, count: value / entry.amount }))
    .filter(({ count }) => count >= 0.1 && count <= 100)
    .sort((a, b) => {
      const byTier = tier(a.count, a.entry.stale === true) - tier(b.count, b.entry.stale === true);
      if (byTier !== 0) return byTier;
      const byDistance = distance(a.count) - distance(b.count);
      if (byDistance !== 0) return byDistance;
      return a.entry.id < b.entry.id ? -1 : 1;
    });

  return candidates.slice(0, limit).map(({ entry, count }) => ({
    id: entry.id,
    count,
    label: count >= 0.995 && count < 1.005 ? entry.singular : entry.plural,
    stale: entry.stale === true,
    source: entry.source,
    ...(entry.notes ? { notes: entry.notes } : {}),
  }));
};
