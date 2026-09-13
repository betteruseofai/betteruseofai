import datasetBundle from '@betteruseofai/dataset';
import { estimate } from '@betteruseofai/core';
import type { Dataset, UsageEvent } from '@betteruseofai/core';
import { describe, expect, it } from 'vitest';

import { computeSaving } from '../src/lib/saving.js';
import type { StoredEvent } from '../src/lib/storage.js';

/**
 * The saving is a counterfactual with a stated baseline, and these tests are
 * about the honesty of that: a frontier turn saves nothing, an unrecognised
 * turn is skipped and counted as skipped, and every figure is a range.
 */

const dataset = datasetBundle as unknown as Dataset;

const turn = (modelId: string | null, day: string, index: number): StoredEvent => {
  const event: UsageEvent = {
    id: `${day}-${index}`,
    surface: 'claude-web',
    hosting: 'cloud',
    modelRaw: modelId ?? 'mystery-9000',
    modelId,
    tokens: { input: 400, output: 300, thinking: null, estimated: true, estimator: 'test' },
    timestamp: `${day}T09:0${index}:00.000Z`,
  };
  return {
    id: event.id,
    event,
    estimate: estimate(event, { dataset, regionCode: 'WORLD' }),
    datasetVersion: dataset.version,
    day,
    surface: event.surface,
  };
};

describe('the saving against the largest model in each family', () => {
  it('is nothing for a turn already on the frontier model', () => {
    const saving = computeSaving([turn('claude-opus-5', '2026-09-01', 1)], dataset, {});
    expect(saving.energyWh).toBeNull();
    expect(saving.skipped).toBe(0);
    // The day still exists, so a ring is drawn for it, thin.
    expect(saving.byDay).toEqual([{ day: '2026-09-01', energyWh: null }]);
  });

  it('is a positive range for a turn on a smaller model, on the same rows', () => {
    const small = turn('claude-haiku-4.5', '2026-09-01', 1);
    const saving = computeSaving([small], dataset, {});
    expect(saving.energyWh).not.toBeNull();
    expect(saving.energyWh!.central).toBeGreaterThan(0);
    expect(saving.energyWh!.low).toBeGreaterThanOrEqual(0);
    expect(saving.energyWh!.high).toBeGreaterThan(saving.energyWh!.central);
    // The saving is the frontier estimate less the actual one, nothing more.
    const frontier = estimate({ ...small.event, modelId: 'claude-opus-5' }, { dataset });
    expect(saving.energyWh!.central).toBeCloseTo(frontier.energyWh!.central - small.estimate.energyWh!.central, 6);
  });

  it('skips a turn it cannot re-price and says how many', () => {
    const saving = computeSaving([turn(null, '2026-09-01', 1), turn('claude-haiku-4.5', '2026-09-01', 2)], dataset, {});
    expect(saving.skipped).toBe(1);
    expect(saving.energyWh).not.toBeNull();
  });

  it('accumulates by day, in date order', () => {
    const saving = computeSaving(
      [turn('claude-haiku-4.5', '2026-09-02', 1), turn('claude-haiku-4.5', '2026-09-01', 1)],
      dataset,
      {},
    );
    expect(saving.byDay.map((one) => one.day)).toEqual(['2026-09-01', '2026-09-02']);
    expect(saving.byDay[0]!.energyWh!.central).toBeCloseTo(saving.byDay[1]!.energyWh!.central, 9);
  });
});
