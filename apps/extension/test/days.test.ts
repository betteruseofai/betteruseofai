import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { aggregate, getModel, estimate, saving } from '@betteruseofai/core';
import type { Aggregate, Dataset, UsageEvent } from '@betteruseofai/core';
import datasetBundle from '@betteruseofai/dataset';

import { everyDay, isEmptyDay, localDay } from '../src/lib/days.js';

const dataset = datasetBundle as unknown as Dataset;

/*
 * Node reads TZ afresh whenever a date is turned into local time, so the
 * browser's time zone can be pretended here. India is the case that showed the
 * bug: UTC midnight is 5:30 in the morning there.
 */
const before = process.env['TZ'];
beforeAll(() => {
  process.env['TZ'] = 'Asia/Kolkata';
});
afterAll(() => {
  if (before === undefined) delete process.env['TZ'];
  else process.env['TZ'] = before;
});

const turn = (timestamp: string, model = 'gpt-4o'): { event: UsageEvent; estimate: ReturnType<typeof estimate> } => {
  const event: UsageEvent = {
    id: timestamp,
    surface: 'chatgpt-web',
    hosting: 'cloud',
    modelRaw: model,
    modelId: getModel(model, dataset)?.id ?? model,
    tokens: { input: 200, output: 300, estimated: false, estimator: 'provider' },
    timestamp,
  };
  return { event, estimate: estimate(event, { dataset }) };
};

describe('days in the viewer\'s own time zone', () => {
  it('puts a turn at 1 am in India on that day, not the one before', () => {
    // 19:30 UTC on the 18th is 01:00 on the 19th in India.
    expect(localDay('2026-11-18T19:30:00.000Z')).toBe('2026-11-19');
    expect(localDay('2026-11-18T18:29:00.000Z')).toBe('2026-11-18');
  });

  it('buckets the popup and dashboard by local day, and the command line default stays UTC', () => {
    const pairs = [turn('2026-11-18T10:00:00.000Z'), turn('2026-11-18T19:30:00.000Z')];
    expect(aggregate(pairs, 'day', { dayOf: localDay }).map((one) => one.key)).toEqual([
      '2026-11-18',
      '2026-11-19',
    ]);
    expect(aggregate(pairs, 'day').map((one) => one.key)).toEqual(['2026-11-18']);
  });

  it('draws the saving rings on the same days', () => {
    const pairs = [turn('2026-11-18T19:30:00.000Z', 'gpt-4o-mini')];
    expect(saving(pairs, dataset, { dayOf: localDay }).byDay.map((one) => one.day)).toEqual(['2026-11-19']);
    expect(saving(pairs, dataset).byDay.map((one) => one.day)).toEqual(['2026-11-18']);
  });
});

describe('days with nothing on them', () => {
  const day = (key: string) => ({ key }) as Aggregate;

  it('come back as gaps between the first day and the last', () => {
    const days = everyDay([day('2026-11-20'), day('2026-11-17')]);
    expect(days.map((one) => one.key)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    expect(days.map(isEmptyDay)).toEqual([false, true, true, false]);
  });

  it('cross a month end on the calendar', () => {
    expect(everyDay([day('2026-02-27'), day('2026-03-01')]).map((one) => one.key)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  it('are left out past a year, where a chart of gaps is no use', () => {
    const days = everyDay([day('2024-01-01'), day('2026-01-01')]);
    expect(days.map((one) => one.key)).toEqual(['2024-01-01', '2026-01-01']);
  });

  it('give nothing for nothing', () => {
    expect(everyDay([])).toEqual([]);
  });
});
