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
      const distance = Math.abs(Math.log10(a.count)) - Math.abs(Math.log10(b.count));
      if (distance !== 0) return distance;
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
