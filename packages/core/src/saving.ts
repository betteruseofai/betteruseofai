import { estimate } from './estimate.js';
import type { CarbonBasis, Dataset, Estimate, Range, UsageEvent, WaterScope } from './types.js';

/**
 * What using smaller models has saved, against the frontier model in each
 * family.
 *
 * Nothing here can know what somebody would have done without the tool. What
 * it can compute honestly is a counterfactual with a stated baseline: every
 * turn re-priced as if it had gone to rung zero of its own family, minus what
 * it actually cost. A turn that was already on the frontier model saves
 * nothing. A turn on an unrecognised model cannot be re-priced and is left out,
 * and the count of those is returned so the page can say so.
 *
 * Every figure stays a range, and the two estimates share the same rows,
 * region and scope, so the difference is between like and like. This started
 * life in the extension; it moved here so the dashboard the command line tools
 * write draws the same rings from the same arithmetic, and so the Python tool
 * has one definition to mirror.
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

export interface SavingInput {
  event: UsageEvent;
  estimate: Estimate;
}

export interface SavingOptions {
  regionCode?: string;
  waterScope?: WaterScope;
  carbonBasis?: CarbonBasis;
}

export const SAVING_BASELINE = 'the largest model in each family';

const plus = (a: Range | null, b: Range | null): Range | null => {
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

export const saving = (inputs: SavingInput[], dataset: Dataset, options: SavingOptions = {}): Saving => {
  let energy: Range | null = null;
  let water: Range | null = null;
  let carbon: Range | null = null;
  let skipped = 0;
  const days = new Map<string, Range | null>();

  for (const { event, estimate: actual } of inputs) {
    const day = event.timestamp.slice(0, 10);
    const model = actual.modelId ? dataset.models.find((one) => one.id === actual.modelId) : undefined;
    if (!model || !actual.energyWh) {
      skipped += 1;
      continue;
    }
    if (model.ordinal === 0) {
      // Already the top of the ladder. Nothing saved, nothing skipped.
      if (!days.has(day)) days.set(day, null);
      continue;
    }
    const top = dataset.models.find((one) => one.family === model.family && one.ordinal === 0);
    if (!top) {
      skipped += 1;
      continue;
    }

    const counterfactual = estimate({ ...event, modelId: top.id, modelRaw: top.id }, { dataset, ...options });

    const saved = minus(counterfactual.energyWh, actual.energyWh);
    energy = plus(energy, saved);
    water = plus(water, minus(counterfactual.waterMl, actual.waterMl));
    carbon = plus(carbon, minus(counterfactual.carbonG, actual.carbonG));
    days.set(day, plus(days.get(day) ?? null, saved));
  }

  return {
    baseline: SAVING_BASELINE,
    energyWh: energy,
    waterMl: water,
    carbonG: carbon,
    byDay: [...days.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([day, energyWh]) => ({ day, energyWh })),
    skipped,
  };
};
