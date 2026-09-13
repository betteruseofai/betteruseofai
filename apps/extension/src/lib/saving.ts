import { estimate } from '@betteruseofai/core';
import type { CarbonBasis, Dataset, Range, WaterScope } from '@betteruseofai/core';

import type { StoredEvent } from './storage.js';

/**
 * What using smaller models has saved, against the frontier model in each
 * family.
 *
 * The extension cannot know what somebody would have done without it. What it
 * can compute honestly is a counterfactual with a stated baseline: every turn
 * re-priced as if it had gone to rung zero of its own family, minus what it
 * actually cost. A turn that was already on the frontier model saves nothing.
 * A turn on an unrecognised model cannot be re-priced and is left out, and the
 * count of those is returned so the page can say so.
 *
 * Every figure stays a range, and the two estimates share the same rows,
 * region and scope, so the difference is between like and like.
 */

export interface DaySaving {
  day: string;
  energyWh: Range | null;
}

export interface Saving {
  baseline: string;
  energyWh: Range | null;
  waterMl: Range | null;
  carbonG: Range | null;
  byDay: DaySaving[];
  /** Turns that could not be re-priced, so are not in the figures. */
  skipped: number;
}

const add = (a: Range | null, b: Range | null): Range | null => {
  if (!a) return b;
  if (!b) return a;
  return { low: a.low + b.low, central: a.central + b.central, high: a.high + b.high };
};

/** A minus B, floored at nothing. A saving is never negative. */
const minus = (a: Range | null, b: Range | null): Range | null => {
  if (!a || !b) return null;
  return {
    low: Math.max(0, a.low - b.high),
    central: Math.max(0, a.central - b.central),
    high: Math.max(0, a.high - b.low),
  };
};

export interface SavingOptions {
  regionCode?: string;
  waterScope?: WaterScope;
  carbonBasis?: CarbonBasis;
}

export const computeSaving = (events: StoredEvent[], dataset: Dataset, options: SavingOptions): Saving => {
  let energy: Range | null = null;
  let water: Range | null = null;
  let carbon: Range | null = null;
  let skipped = 0;
  const days = new Map<string, Range | null>();

  for (const stored of events) {
    const { event, estimate: actual } = stored;
    const model = event.modelId ? dataset.models.find((one) => one.id === event.modelId) : null;
    if (!model || !actual.energyWh) {
      skipped += 1;
      continue;
    }
    if (model.ordinal === 0) {
      // Already the top of the ladder. Nothing saved, nothing skipped.
      if (!days.has(stored.day)) days.set(stored.day, null);
      continue;
    }
    const top = dataset.models.find((one) => one.family === model.family && one.ordinal === 0);
    if (!top) {
      skipped += 1;
      continue;
    }

    const counterfactual = estimate({ ...event, modelId: top.id, modelRaw: top.id }, { dataset, ...options });

    const saved = minus(counterfactual.energyWh, actual.energyWh);
    energy = add(energy, saved);
    water = add(water, minus(counterfactual.waterMl, actual.waterMl));
    carbon = add(carbon, minus(counterfactual.carbonG, actual.carbonG));
    days.set(stored.day, add(days.get(stored.day) ?? null, saved));
  }

  return {
    baseline: 'the largest model in each family',
    energyWh: energy,
    waterMl: water,
    carbonG: carbon,
    byDay: [...days.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([day, energyWh]) => ({ day, energyWh })),
    skipped,
  };
};
