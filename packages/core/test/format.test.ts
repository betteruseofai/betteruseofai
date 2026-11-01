import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { aggregate } from '../src/aggregate.js';
import { estimate } from '../src/estimate.js';
import {
  canonicalNumber,
  displayNumber,
  explainFlags,
  formatRange,
  roundSignificant,
  scaleUnit,
} from '../src/format.js';
import { event, loadDataset, tokens } from './helpers.js';

const dataset = loadDataset();
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');

describe('the canonical rounding rule', () => {
  /**
   * This is the contract the Python command line tool has to reproduce byte for
   * byte, so the cases live in a shared fixture rather than only in this file.
   */
  const cases = JSON.parse(readFileSync(join(fixturesDir, 'rounding', 'cases.json'), 'utf8')) as Array<{
    input: number;
    expected: string;
  }>;

  it.each(cases)('$input becomes $expected', ({ input, expected }) => {
    expect(canonicalNumber(input)).toBe(expected);
  });

  it('keeps six significant digits, no more', () => {
    expect(roundSignificant(1.23456789)).toBe(1.23457);
    expect(roundSignificant(123456789)).toBe(123457000);
    expect(roundSignificant(0.000123456789)).toBe(0.000123457);
  });

  it('leaves zero alone rather than dressing it up', () => {
    expect(canonicalNumber(0)).toBe('0');
    expect(roundSignificant(0)).toBe(0);
  });
});

describe('rendering a range', () => {
  it('says unknown for both shapes of absence', () => {
    expect(formatRange(null)).toBe('unknown');
    expect(formatRange(null, { unit: 'Wh' })).toBe('unknown');
    // Undefined reaches here from stored data written by an older version.
    // Reading through it crashed a page before this case was handled.
    expect(formatRange(undefined, { unit: 'Wh' })).toBe('unknown');
  });

  it('shows the central figure with its bounds', () => {
    expect(formatRange({ low: 2.1, central: 3.8, high: 8.4 }, { unit: 'Wh' })).toBe(
      '3.80 Wh [ 2.10 to 8.40 ]',
    );
  });

  it('uses no dash between the bounds, per the copy rules', () => {
    const rendered = formatRange({ low: 1, central: 2, high: 3 }, { unit: 'Wh' });
    expect(rendered).not.toMatch(/[–—]/);
  });

  it('marks a lower bound only where something is known to be missing', () => {
    const range = { low: 0.5, central: 2, high: 9 };
    // A total that left out a turn it couldn't price.
    expect(formatRange(range, { unit: 'Wh', flags: ['model-unknown'] }).startsWith('≥ ')).toBe(true);
    // Undisclosed thinking is inside the range already, so it is not a floor.
    expect(formatRange(range, { unit: 'Wh', flags: ['thinking-unknown'] }).startsWith('≥')).toBe(false);
    // A turn with no energy figure is missing from energy, not from water.
    expect(formatRange(range, { unit: 'Wh', flags: ['no-energy-figure'] }).startsWith('≥ ')).toBe(true);
    expect(formatRange(range, { unit: 'mL', flags: ['no-energy-figure'] }).startsWith('≥')).toBe(false);
  });

  it('has an ascii mode for a status line', () => {
    const rendered = formatRange({ low: 0.5, central: 2, high: 9 }, {
      unit: 'Wh',
      flags: ['model-unknown'],
      ascii: true,
    });
    expect(rendered.startsWith('>= ')).toBe(true);
    // eslint-disable-next-line no-control-regex
    expect(/^[\u0000-\u007f]*$/.test(rendered)).toBe(true);
  });

  it('marks an estimated figure with a tilde', () => {
    expect(
      formatRange({ low: 1, central: 2, high: 3 }, { unit: 'Wh', flags: ['tokens-estimated'], bounds: false }),
    ).toBe('~2.00 Wh');
  });

  it('steps up to a larger unit once the number stops being readable', () => {
    // An agent session reaches thousands of watt hours, and 7111 Wh is a
    // number nobody pictures.
    expect(formatRange({ low: 2745, central: 17264, high: 192342 }, { unit: 'Wh' })).toBe(
      '17.3 kWh [ 2.75 to 192 ]',
    );
    expect(formatRange({ low: 100, central: 500, high: 900 }, { unit: 'Wh' })).toBe(
      '500 Wh [ 100 to 900 ]',
    );
    expect(scaleUnit(56350, 'mL')).toEqual({ value: 56.35, unit: 'L' });
    expect(scaleUnit(12258, 'g')).toEqual({ value: 12.258, unit: 'kg' });
    expect(scaleUnit(500, 'mL')).toEqual({ value: 500, unit: 'mL' });
  });

  it('shows the whole range in one unit, so the bounds can be compared', () => {
    const rendered = formatRange({ low: 500, central: 5000, high: 50000 }, { unit: 'Wh' });
    // One unit named once, not three.
    expect(rendered.match(/kWh|Wh/g)).toHaveLength(1);
    expect(rendered).toBe('5.00 kWh [ 0.500 to 50.0 ]');
  });

  it('scales its decimals to the size of the number', () => {
    expect(displayNumber(1234)).toBe('1234');
    expect(displayNumber(12.34)).toBe('12.3');
    expect(displayNumber(1.234)).toBe('1.23');
    expect(displayNumber(0.1234)).toBe('0.123');
    expect(displayNumber(0.001234)).toBe('0.0012');
  });
});

describe('explaining a flag', () => {
  it('gives a plain sentence for every flag an estimate can carry', () => {
    const seen = new Set<string>();
    for (const model of dataset.models) {
      const result = estimate(event({ modelRaw: model.id, tokens: tokens({ thinking: null }) }), {
        dataset,
      });
      for (const flag of result.basis.flags) seen.add(flag);
    }
    const explained = explainFlags([...seen] as never);
    expect(explained.length).toBe(seen.size);
    for (const line of explained) {
      expect(line.length).toBeGreaterThan(20);
      expect(line).not.toMatch(/[–—!]/);
    }
  });
});

describe('rolling up', () => {
  const day = (iso: string, modelRaw: string) =>
    event({ timestamp: iso, modelRaw, tokens: tokens({ thinking: 0 }) });

  const inputs = [
    day('2026-09-01T09:00:00.000Z', 'gpt-4o'),
    day('2026-09-01T18:00:00.000Z', 'gpt-4o'),
    day('2026-09-03T09:00:00.000Z', 'claude-3.7-sonnet'),
    day('2026-09-09T09:00:00.000Z', 'gpt-4.1-nano'),
  ].map((one) => ({ event: one, estimate: estimate(one, { dataset }) }));

  it('groups by day', () => {
    const rolled = aggregate(inputs, 'day');
    expect(rolled.map((bucket) => bucket.key)).toEqual(['2026-09-01', '2026-09-03', '2026-09-09']);
    expect(rolled[0]?.count).toBe(2);
  });

  it('groups by the Monday of each week', () => {
    const rolled = aggregate(inputs, 'week');
    // 1 and 3 September 2026 are a Tuesday and a Thursday, so both fall in the week of the 31st.
    expect(rolled.map((bucket) => bucket.key)).toEqual(['2026-08-31', '2026-09-07']);
    expect(rolled[0]?.count).toBe(3);
  });

  it('groups by model and by surface', () => {
    expect(aggregate(inputs, 'model').map((bucket) => bucket.key)).toEqual([
      'claude-3.7-sonnet',
      'gpt-4.1-nano',
      'gpt-4o',
    ]);
    expect(aggregate(inputs, 'surface').map((bucket) => bucket.key)).toEqual(['api']);
  });

  it('adds the bounds up bound by bound', () => {
    const total = aggregate(inputs, 'all')[0];
    const sum = inputs.reduce((acc, item) => acc + (item.estimate.energyWh?.central ?? 0), 0);
    expect(total?.energyWh?.central).toBeCloseTo(sum, 10);
  });

  it('carries every flag that any member carried', () => {
    const total = aggregate(inputs, 'all')[0];
    expect(total?.flags).toContain('region-default');
    expect(total?.flags).toEqual([...(total?.flags ?? [])].sort());
  });

  it('returns buckets in a stable order, so the two implementations agree', () => {
    const once = aggregate(inputs, 'day').map((bucket) => bucket.key);
    const twice = aggregate([...inputs].reverse(), 'day').map((bucket) => bucket.key);
    expect(twice).toEqual(once);
  });
});
