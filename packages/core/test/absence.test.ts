import { describe, expect, it } from 'vitest';

import { aggregate } from '../src/aggregate.js';
import { equivalents } from '../src/equivalents.js';
import { estimate } from '../src/estimate.js';
import { formatRange } from '../src/format.js';
import { resolveModel } from '../src/resolve.js';
import { event, loadDataset, tokens } from './helpers.js';

/**
 * The rule this project exists to keep: absence never renders as zero.
 *
 * Every path that could quietly turn a missing value into nought gets a test
 * here. If one of these ever goes green by accident the tool has started lying
 * in the flattering direction.
 */

const dataset = loadDataset();

describe('an unrecognised model', () => {
  it('resolves to null rather than to something close', () => {
    expect(resolveModel('some-model-nobody-has-heard-of', dataset)).toBeNull();
    expect(resolveModel('claude-opus-99', dataset)).toBeNull();
    expect(resolveModel('', dataset)).toBeNull();
    expect(resolveModel(undefined, dataset)).toBeNull();
  });

  it('never resolves a synthetic transcript line', () => {
    expect(resolveModel('<synthetic>', dataset)).toBeNull();
  });

  it('produces null figures and a flag, not zeroes', () => {
    const result = estimate(event({ modelRaw: 'not-a-model' }), { dataset });
    expect(result.energyWh).toBeNull();
    expect(result.waterMl).toBeNull();
    expect(result.carbonG).toBeNull();
    expect(result.modelId).toBeNull();
    expect(result.basis.flags).toContain('model-unknown');
  });

  it('renders as the word unknown', () => {
    const result = estimate(event({ modelRaw: 'not-a-model' }), { dataset });
    expect(formatRange(result.energyWh, { unit: 'Wh' })).toBe('unknown');
  });

  it('is counted separately in an aggregate and left out of the totals', () => {
    const known = event({ modelRaw: 'claude-opus-5' });
    const unknown = event({ modelRaw: 'not-a-model' });
    const rolled = aggregate(
      [
        { event: known, estimate: estimate(known, { dataset }) },
        { event: unknown, estimate: estimate(unknown, { dataset }) },
      ],
      'all',
    );
    const total = rolled[0];
    expect(total?.count).toBe(2);
    expect(total?.unknownModelCount).toBe(1);
    expect(total?.energyWh).not.toBeNull();
    // The known event alone accounts for the total; the unknown one added nothing.
    const onlyKnown = estimate(known, { dataset });
    expect(total?.energyWh?.central).toBeCloseTo(onlyKnown.energyWh?.central ?? -1, 10);
  });

  it('a bucket of nothing but unknowns has null totals, not zeroes', () => {
    const one = event({ modelRaw: 'not-a-model' });
    const rolled = aggregate([{ event: one, estimate: estimate(one, { dataset }) }], 'all');
    expect(rolled[0]?.energyWh).toBeNull();
    expect(rolled[0]?.waterMl).toBeNull();
    expect(rolled[0]?.carbonG).toBeNull();
    expect(rolled[0]?.unknownModelCount).toBe(1);
  });
});

describe('undisclosed thinking tokens', () => {
  const withUnknownThinking = event({
    modelRaw: 'claude-opus-5',
    tokens: tokens({ thinking: null }),
  });

  it('are flagged rather than assumed away', () => {
    const result = estimate(withUnknownThinking, { dataset });
    expect(result.basis.flags).toContain('thinking-unknown');
    expect(result.basis.thinkingHandling).toBe('estimated');
  });

  it('start at zero at the low bound and rise well above it at the high bound', () => {
    const result = estimate(withUnknownThinking, { dataset });
    expect(result.basis.thinkingTokens?.low).toBe(0);
    expect(result.basis.thinkingTokens?.central).toBeGreaterThan(0);
    expect(result.basis.thinkingTokens?.high).toBeGreaterThan(
      result.basis.thinkingTokens?.central ?? 0,
    );
  });

  it('render as a lower bound, not as a settled figure', () => {
    const result = estimate(withUnknownThinking, { dataset });
    expect(formatRange(result.energyWh, { unit: 'Wh', flags: result.basis.flags })).toMatch(/^≥ /);
    expect(
      formatRange(result.energyWh, { unit: 'Wh', flags: result.basis.flags, ascii: true }),
    ).toMatch(/^>= /);
  });

  it('cost more than the same exchange with no thinking at all', () => {
    const none = estimate(event({ modelRaw: 'claude-opus-5', tokens: tokens({ thinking: 0 }) }), {
      dataset,
    });
    const unknown = estimate(withUnknownThinking, { dataset });
    expect(unknown.energyWh?.central).toBeGreaterThan(none.energyWh?.central ?? Infinity);
    // The low bound is the one case where they should agree: no thinking assumed.
    expect(unknown.energyWh?.low).toBeCloseTo(none.energyWh?.low ?? -1, 10);
  });

  it('a reported count is used as it stands and carries no flag', () => {
    const reported = estimate(
      event({ modelRaw: 'claude-opus-5', tokens: tokens({ thinking: 1200 }) }),
      { dataset },
    );
    expect(reported.basis.thinkingHandling).toBe('reported');
    expect(reported.basis.flags).not.toContain('thinking-unknown');
    expect(reported.basis.thinkingTokens).toEqual({ low: 1200, central: 1200, high: 1200 });
  });

  it('a model that cannot think charges nothing and says so', () => {
    const result = estimate(
      event({ modelRaw: 'claude-3.5-sonnet', tokens: tokens({ thinking: undefined }) }),
      { dataset },
    );
    expect(result.basis.thinkingHandling).toBe('not-applicable');
    expect(result.basis.thinkingTokens).toBeNull();
    expect(result.basis.flags).not.toContain('thinking-unknown');
  });

  it('undefined and null are not the same thing', () => {
    const cannotThink = estimate(
      event({ modelRaw: 'claude-3.5-sonnet', tokens: tokens({ thinking: undefined }) }),
      { dataset },
    );
    const didNotSay = estimate(
      event({ modelRaw: 'claude-3.7-sonnet', tokens: tokens({ thinking: null }) }),
      { dataset },
    );
    expect(cannotThink.basis.thinkingHandling).toBe('not-applicable');
    expect(didNotSay.basis.thinkingHandling).toBe('estimated');
  });
});

describe('a cache hit', () => {
  it('may be free at the low bound and is never free at the high bound', () => {
    const cached = estimate(
      event({
        modelRaw: 'claude-opus-5',
        tokens: tokens({ input: 0, output: 100, cachedRead: 50000 }),
      }),
      { dataset },
    );
    const nothing = estimate(
      event({ modelRaw: 'claude-opus-5', tokens: tokens({ input: 0, output: 100 }) }),
      { dataset },
    );
    expect(cached.energyWh?.low).toBeCloseTo(nothing.energyWh?.low ?? -1, 10);
    expect(cached.energyWh?.high).toBeGreaterThan(nothing.energyWh?.high ?? Infinity);
  });
});

describe('equivalents', () => {
  it('return nothing rather than an unreadable fraction', () => {
    expect(equivalents(0.0000001, 'energy', dataset)).toEqual([]);
    expect(equivalents(null, 'energy', dataset)).toEqual([]);
    expect(equivalents(0, 'energy', dataset)).toEqual([]);
  });

  it('pick comparisons a person can picture', () => {
    const found = equivalents(4, 'energy', dataset);
    expect(found.length).toBeGreaterThan(0);
    for (const item of found) {
      expect(item.count).toBeGreaterThanOrEqual(0.1);
      expect(item.count).toBeLessThanOrEqual(100);
      expect(item.source.url).toBeTruthy();
    }
  });

  it('prefer a whole number of small things over a fraction of a big one', () => {
    // 43.8 mL is nine teaspoons or a fifth of a glass. The teaspoons win.
    const found = equivalents(43.8, 'water', dataset);
    expect(found[0]?.id).toBe('teaspoon');
    expect(found[0]?.count).toBeGreaterThan(1);
  });

  it('still take a count below one when nothing above it is in range', () => {
    const found = equivalents(120, 'water', dataset);
    expect(found.length).toBeGreaterThan(0);
  });

  it('mark the seventeen year old search figure as stale', () => {
    const found = dataset.equivalents.find((entry) => entry.id === 'google-search');
    expect(found?.stale).toBe(true);
  });
});
