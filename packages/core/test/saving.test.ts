import datasetBundle from '@betteruseofai/dataset';
import { describe, expect, it } from 'vitest';

import { estimate, saving } from '../src/index.js';
import type { Dataset, SavingInput, UsageEvent } from '../src/index.js';

/**
 * The saving is a counterfactual with a stated baseline, and these tests are
 * about the honesty of that: a frontier turn saves nothing, an unrecognised
 * turn is skipped and counted as skipped, and every figure is a range. They
 * came over from the extension when the arithmetic moved here so the dashboard
 * the command line tools write could draw the same rings.
 */

const dataset = datasetBundle as unknown as Dataset;

const turn = (modelId: string | null, day: string, index: number): SavingInput => {
  const event: UsageEvent = {
    id: `${day}-${index}`,
    surface: 'claude-web',
    hosting: 'cloud',
    modelRaw: modelId ?? 'mystery-9000',
    modelId,
    tokens: { input: 400, output: 300, thinking: null, estimated: true, estimator: 'test' },
    timestamp: `${day}T09:0${index}:00.000Z`,
  };
  return { event, estimate: estimate(event, { dataset, regionCode: 'WORLD' }) };
};

describe('the saving against the largest model in each family', () => {
  it('is nothing for a turn already on the frontier model', () => {
    const saved = saving([turn('claude-opus-5', '2026-09-01', 1)], dataset, {});
    expect(saved.energyWh).toBeNull();
    expect(saved.skipped).toBe(0);
    // The day still exists, so a ring is drawn for it, thin.
    expect(saved.byDay).toEqual([{ day: '2026-09-01', energyWh: null }]);
  });

  it('is a positive range for a turn on a smaller model, on the same rows', () => {
    const small = turn('claude-haiku-4.5', '2026-09-01', 1);
    const saved = saving([small], dataset, {});
    expect(saved.energyWh).not.toBeNull();
    expect(saved.energyWh!.central).toBeGreaterThan(0);
    expect(saved.energyWh!.low).toBeGreaterThanOrEqual(0);
    expect(saved.energyWh!.high).toBeGreaterThan(saved.energyWh!.central);
    // The saving is the frontier estimate less the actual one, nothing more.
    const frontier = estimate({ ...small.event, modelId: 'claude-opus-5' }, { dataset });
    expect(saved.energyWh!.central).toBeCloseTo(frontier.energyWh!.central - small.estimate.energyWh!.central, 6);
  });

  it('skips a turn it cannot re-price and says how many', () => {
    const saved = saving([turn(null, '2026-09-01', 1), turn('claude-haiku-4.5', '2026-09-01', 2)], dataset, {});
    expect(saved.skipped).toBe(1);
    expect(saved.energyWh).not.toBeNull();
  });

  it('accumulates by day, in date order', () => {
    const saved = saving(
      [turn('claude-haiku-4.5', '2026-09-02', 1), turn('claude-haiku-4.5', '2026-09-01', 1)],
      dataset,
      {},
    );
    expect(saved.byDay.map((one) => one.day)).toEqual(['2026-09-01', '2026-09-02']);
    expect(saved.byDay[0]!.energyWh!.central).toBeCloseTo(saved.byDay[1]!.energyWh!.central, 9);
  });

  it('takes the day from the timestamp, so a log line and a transcript line agree', () => {
    const saved = saving([turn('claude-sonnet-5', '2026-08-21', 3)], dataset, {});
    expect(saved.byDay[0]!.day).toBe('2026-08-21');
  });
});
