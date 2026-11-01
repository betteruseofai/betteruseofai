import { describe, expect, it } from 'vitest';

import { aggregate } from '../src/aggregate.js';
import { estimate } from '../src/estimate.js';
import { formatRange, isLowerBound } from '../src/format.js';
import { fitQuerySet, normalizeToPerToken } from '../src/normalize.js';
import { downgradeTarget, getModel, resolveModel, selectBenchmark } from '../src/resolve.js';
import { event, loadDataset, tokens } from './helpers.js';

const dataset = loadDataset();
const model = (id: string) => {
  const found = getModel(id, dataset);
  if (!found) throw new Error(`test wants a model that is not in the dataset: ${id}`);
  return found;
};

describe('picking a benchmark row', () => {
  it('prefers a row that models token scaling over a single published figure', () => {
    const row = selectBenchmark(model('gpt-4o'), dataset, { at: '2026-09-01' });
    expect(row?.id).toBe('jegham.gpt-4o');
  });

  it('is the only row available for a model with nothing but a proxy', () => {
    expect(selectBenchmark(model('claude-opus-5'), dataset, { at: '2026-09-01' })?.id).toBe(
      'proxy.claude-opus',
    );
  });

  it('skips a row that had not been published at the time of the event', () => {
    expect(selectBenchmark(model('gemini-2.5-flash'), dataset, { at: '2024-01-01' })).toBeNull();
    expect(selectBenchmark(model('gemini-2.5-flash'), dataset, { at: '2026-01-01' })?.id).toBe(
      'google.gemini-apps.2025-median',
    );
  });

  it('costs a model on your own machine from a row with no data centre overhead', () => {
    const row = selectBenchmark(model('llama-3.1-8b'), dataset, { at: '2026-09-01', hosting: 'local' });
    expect(row?.id).toBe('ecologits.parametric.local');
    expect(row?.pue.high).toBe(1);
  });

  it('costs the same model in the cloud from a measured row instead', () => {
    const row = selectBenchmark(model('llama-3.3-70b'), dataset, { at: '2026-09-01', hosting: 'cloud' });
    expect(row?.id).toBe('jegham.llama-3.3-70b');
  });

  it('is deterministic, so the two language implementations agree', () => {
    for (const candidate of dataset.models) {
      const first = selectBenchmark(candidate, dataset, { at: '2026-09-01' })?.id ?? null;
      const second = selectBenchmark(candidate, dataset, { at: '2026-09-01' })?.id ?? null;
      expect(second).toBe(first);
    }
  });
});

describe('fitting a set of measured points', () => {
  it('recovers the line it was given', () => {
    const fit = fitQuerySet([
      { inputTokens: 100, outputTokens: 300, energyWh: 1 + 0.001 * 100 + 0.002 * 300 },
      { inputTokens: 1000, outputTokens: 1000, energyWh: 1 + 0.001 * 1000 + 0.002 * 1000 },
      { inputTokens: 10000, outputTokens: 1500, energyWh: 1 + 0.001 * 10000 + 0.002 * 1500 },
    ]);
    expect(fit.intercept).toBeCloseTo(1, 4);
    expect(fit.inputWh).toBeCloseTo(0.001, 6);
    expect(fit.outputWh).toBeCloseTo(0.002, 6);
  });

  it('never produces a negative rate, so a longer prompt can never cost less', () => {
    // The published o4-mini set is not monotonic and a plain fit gives a negative
    // input rate. Dropping the term and refitting is the honest response.
    const row = dataset.benchmarks.find((r) => r.id === 'jegham.o4-mini');
    const fit = fitQuerySet(row?.perQuerySet?.points ?? []);
    expect(fit.inputWh).toBeGreaterThanOrEqual(0);
    expect(fit.outputWh).toBeGreaterThanOrEqual(0);
    expect(fit.intercept).toBeGreaterThanOrEqual(0);
  });

  it('every row in the dataset fits to non-negative rates', () => {
    for (const row of dataset.benchmarks.filter((r) => r.shape === 'per-query-set')) {
      const fit = fitQuerySet(row.perQuerySet?.points ?? []);
      expect(fit.inputWh, row.id).toBeGreaterThanOrEqual(0);
      expect(fit.outputWh, row.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('normalising each shape', () => {
  const calibration = dataset.calibration;

  it.each(['per-query-set', 'per-prompt', 'parametric', 'proxy'] as const)(
    'turns a %s row into ordered non-negative rates',
    (shape) => {
      const row = dataset.benchmarks.find(
        (candidate) => candidate.shape === shape && candidate.id !== 'mistral.large-2.lca.2025',
      );
      expect(row, `no ${shape} row in the dataset`).toBeDefined();
      if (!row) return;
      const target = model(row.modelIds[0] as string);
      const rates = normalizeToPerToken(row, { dataset, model: target, calibration });
      expect(rates, row.id).not.toBeNull();
      if (!rates) return;
      for (const rate of [rates.inputWh, rates.outputWh, rates.interceptWh]) {
        expect(rate.low).toBeGreaterThanOrEqual(0);
        expect(rate.low).toBeLessThanOrEqual(rate.central);
        expect(rate.central).toBeLessThanOrEqual(rate.high);
      }
    },
  );

  it('an output token always costs more than an input token', () => {
    for (const row of dataset.benchmarks) {
      const target = model(row.modelIds[0] as string);
      const rates = normalizeToPerToken(row, { dataset, model: target, calibration });
      if (!rates) continue;
      expect(rates.outputWh.central, row.id).toBeGreaterThanOrEqual(rates.inputWh.central);
    }
  });

  it('a proxy row carries its flag and its parent through', () => {
    const row = dataset.benchmarks.find((r) => r.id === 'proxy.claude-opus');
    if (!row) throw new Error('missing proxy row');
    const rates = normalizeToPerToken(row, { dataset, model: model('claude-opus-5'), calibration });
    expect(rates?.flags).toContain('proxy-row');
    expect(rates?.rootRowId).toBe('jegham.claude-3.7-sonnet');
  });

  it('a row that publishes water and carbon but no energy yields no rate at all', () => {
    const row = dataset.benchmarks.find((r) => r.id === 'mistral.large-2.lca.2025');
    if (!row) throw new Error('missing Mistral row');
    expect(normalizeToPerToken(row, { dataset, model: model('mistral-large-2'), calibration })).toBeNull();
  });
});

describe('the numbers land where the published measurements land', () => {
  it('a short frontier prompt costs single digit watt hours, not milliwatt hours or kilowatt hours', () => {
    const result = estimate(
      event({ modelRaw: 'claude-opus-5', tokens: tokens({ input: 2000, output: 800, thinking: null }) }),
      { dataset },
    );
    expect(result.energyWh?.central).toBeGreaterThan(0.5);
    expect(result.energyWh?.central).toBeLessThan(50);
  });

  it('reproduces the published Jegham figure for the model it was measured on', () => {
    // Short prompt: 100 in, 300 out, published as 0.950 Wh. Their equation 1 already
    // multiplies by PUE, so the published figure is the one we should land on.
    const result = estimate(
      event({
        modelRaw: 'claude-3.7-sonnet',
        tokens: tokens({ input: 100, output: 300, thinking: 0 }),
      }),
      { dataset },
    );
    expect(result.energyWh?.central).toBeCloseTo(0.95, 3);
  });

  it('a reasoning model costs more than a plain one for the same exchange', () => {
    const shape = tokens({ input: 1000, output: 1000, thinking: 0 });
    const plain = estimate(event({ modelRaw: 'gpt-4o', tokens: shape }), { dataset });
    const reasoning = estimate(event({ modelRaw: 'o3', tokens: shape }), { dataset });
    expect(reasoning.energyWh?.central).toBeGreaterThan(plain.energyWh?.central ?? Infinity);
  });

  it('a smaller model costs less than the frontier one on the same ladder', () => {
    const shape = tokens({ input: 1000, output: 1000, thinking: 0 });
    const big = estimate(event({ modelRaw: 'gpt-4.1', tokens: shape }), { dataset });
    const small = estimate(event({ modelRaw: 'gpt-4.1-nano', tokens: shape }), { dataset });
    expect(small.energyWh?.central).toBeLessThan(big.energyWh?.central ?? 0);
  });

  it('a hundred thousand token context costs far more than a short prompt', () => {
    const short = estimate(
      event({ modelRaw: 'gpt-4o', tokens: tokens({ input: 100, output: 500, thinking: undefined }) }),
      { dataset },
    );
    const long = estimate(
      event({ modelRaw: 'gpt-4o', tokens: tokens({ input: 100000, output: 500, thinking: undefined }) }),
      { dataset },
    );
    expect(long.energyWh?.central).toBeGreaterThan((short.energyWh?.central ?? 0) * 5);
  });

  it('the parametric fallback stays within reach of the measurement for the same model', () => {
    // If these two diverge wildly the formula's unit convention is wrong. The
    // dataset changelog records this as an open question, so the bound is loose.
    const shape = tokens({ input: 100, output: 300, thinking: undefined });
    const measured = estimate(
      event({ modelRaw: 'llama-3.3-70b', hosting: 'cloud', tokens: shape }),
      { dataset },
    );
    const formula = estimate(
      event({ modelRaw: 'llama-3.3-70b', hosting: 'local', tokens: shape }),
      { dataset },
    );
    const ratio = (measured.energyWh?.central ?? 0) / (formula.energyWh?.central ?? 1);
    expect(ratio).toBeGreaterThan(1 / 30);
    expect(ratio).toBeLessThan(30);
  });
});

describe('water', () => {
  const shape = tokens({ input: 1000, output: 1000, thinking: 0 });

  it('grows as the scope widens, because a wider boundary counts more of it', () => {
    const onsite = estimate(event({ modelRaw: 'claude-3.7-sonnet', tokens: shape }), {
      dataset,
      waterScope: 'on-site',
    });
    const both = estimate(event({ modelRaw: 'claude-3.7-sonnet', tokens: shape }), {
      dataset,
      waterScope: 'on-site + off-site',
    });
    expect(both.waterMl?.central).toBeGreaterThan(onsite.waterMl?.central ?? Infinity);
  });

  it('records which scope produced the figure', () => {
    const result = estimate(event({ modelRaw: 'claude-3.7-sonnet', tokens: shape }), {
      dataset,
      waterScope: 'lifecycle',
    });
    expect(result.basis.waterScope).toBe('lifecycle');
  });

  it('uses a directly published life-cycle figure rather than deriving one', () => {
    const result = estimate(event({ modelRaw: 'mistral-large-2', tokens: shape }), {
      dataset,
      waterScope: 'lifecycle',
    });
    expect(result.basis.benchmarkRowId).toBe('mistral.large-2.lca.2025');
    expect(result.basis.flags).toContain('scaled-direct-figure');
    expect(result.basis.flags).toContain('no-energy-figure');
    // It already counts making the hardware, so it is not a lower bound.
    expect(result.basis.flags).not.toContain('embodied-missing');
    expect(result.energyWh).toBeNull();
    expect(result.waterMl?.central).toBeGreaterThan(0);
    expect(result.carbonG?.central).toBeGreaterThan(0);
  });

  it('cannot narrow a life-cycle figure, so a narrower scope gives unknown', () => {
    for (const waterScope of ['on-site', 'on-site + off-site'] as const) {
      const result = estimate(event({ modelRaw: 'mistral-large-2', tokens: shape }), {
        dataset,
        waterScope,
      });
      expect(result.waterMl).toBeNull();
      expect(result.carbonG).toBeNull();
      expect(result.basis.flags).toContain('direct-scope-wider');
    }
  });

  it('widens an on-site figure by adding the power station from the energy', () => {
    const at = (waterScope: 'on-site' | 'on-site + off-site' | 'lifecycle') =>
      estimate(event({ modelRaw: 'gpt-5', tokens: shape }), { dataset, waterScope });
    const onsite = at('on-site');
    const both = at('on-site + off-site');
    expect(onsite.basis.benchmarkRowId).toBe('openai.altman-statement.2025');
    const world = dataset.regions.find((region) => region.code === 'WORLD')!;
    const offSite = (onsite.energyWh!.central / 1000) * world.waterOffsiteLPerKwh.central * 1000;
    expect(both.waterMl!.central).toBeCloseTo(onsite.waterMl!.central + offSite, 6);
    // Lifecycle adds nothing it knows, so it is the same figure marked as a lower bound.
    const lifecycle = at('lifecycle');
    expect(lifecycle.waterMl).toEqual(both.waterMl);
    expect(lifecycle.basis.flags).toContain('embodied-missing');
    expect(both.basis.flags).not.toContain('embodied-missing');
  });

  it('marks water and carbon, not energy, as lower bounds when making the hardware is missing', () => {
    const plain = estimate(event({ modelRaw: 'claude-opus-5', tokens: shape }), { dataset });
    const lifecycle = estimate(event({ modelRaw: 'claude-opus-5', tokens: shape }), {
      dataset,
      waterScope: 'lifecycle',
    });
    expect(lifecycle.waterMl).toEqual(plain.waterMl);
    expect(lifecycle.carbonG).toEqual(plain.carbonG);
    const flags = lifecycle.basis.flags;
    expect(flags).toContain('embodied-missing');
    expect(isLowerBound(flags, 'energy')).toBe(false);
    expect(isLowerBound(flags, 'water')).toBe(true);
    expect(isLowerBound(flags, 'carbon')).toBe(true);
    expect(formatRange(lifecycle.energyWh, { unit: 'Wh', flags })).not.toMatch(/^≥/);
    expect(formatRange(lifecycle.waterMl, { unit: 'mL', flags })).toMatch(/^≥ /);
    expect(formatRange(lifecycle.carbonG, { unit: 'g', flags })).toMatch(/^≥ /);
  });

  it('marks a total that left out turns it could not price as a lower bound', () => {
    const known = event({ id: 'a', modelRaw: 'claude-opus-5', tokens: shape });
    const unknown = event({ id: 'b', modelRaw: 'not-a-model', tokens: shape });
    const total = aggregate(
      [known, unknown].map((one) => ({ event: one, estimate: estimate(one, { dataset }) })),
      'all',
    )[0];
    expect(total?.flags).toContain('model-unknown');
    for (const measure of ['energy', 'water', 'carbon'] as const) {
      expect(isLowerBound(total?.flags ?? [], measure)).toBe(true);
    }
    expect(formatRange(total?.energyWh ?? null, { unit: 'Wh', flags: total?.flags ?? [] })).toMatch(/^≥ /);
  });

  it('pairs a per-prompt row with its own reference lengths (E6)', () => {
    // A 200 in, 300 out reply on the R1 distill read 0.011 to 208 Wh, because a
    // long reference exchange's energy was divided by the typical length.
    const r1 = estimate(event({ modelRaw: 'deepseek-r1-distill-llama-70b', tokens: shape }), { dataset });
    expect(r1.energyWh?.high).toBeLessThan(10);
    // The central does not move.
    const gpt5 = estimate(event({ modelRaw: 'gpt-5', tokens: tokens({ input: 200, output: 300, thinking: 0 }) }), {
      dataset,
    });
    expect(gpt5.energyWh?.central).toBeCloseTo(0.34, 6);
    expect(gpt5.energyWh?.high).toBeLessThan(3);
  });

  it('says a local model was priced from a hosted row whatever the row overhead (E7)', () => {
    const local = estimate(event({ modelRaw: 'mistral-large-2', hosting: 'local', tokens: shape }), {
      dataset,
      waterScope: 'lifecycle',
    });
    expect(local.basis.flags).toContain('local-row-missing');
  });

  it('records the carbon basis it actually used (E8)', () => {
    // No proxy row carries a provider factor, so the grid is what was used.
    const proxied = estimate(event({ modelRaw: 'claude-opus-5', tokens: shape }), {
      dataset,
      carbonBasis: 'provider-reported',
    });
    expect(proxied.basis.carbonBasis).toBe('location-based');
  });

  it('marks a total that left out a turn with no water figure as a lower bound on water (E9)', () => {
    const noWater = estimate(event({ modelRaw: 'deepseek-r1-distill-llama-70b', tokens: shape }), {
      dataset,
      waterScope: 'on-site',
    });
    expect(noWater.waterMl).toBeNull();
    expect(noWater.basis.flags).toContain('no-water-figure');
    const total = aggregate(
      [
        { event: event({ id: 'a', modelRaw: 'claude-opus-5', tokens: shape }), estimate: estimate(event({ id: 'a', modelRaw: 'claude-opus-5', tokens: shape }), { dataset, waterScope: 'on-site' }) },
        { event: event({ id: 'b', modelRaw: 'deepseek-r1-distill-llama-70b', tokens: shape }), estimate: noWater },
      ],
      'all',
    )[0];
    expect(isLowerBound(total?.flags ?? [], 'water')).toBe(true);
    expect(isLowerBound(total?.flags ?? [], 'energy')).toBe(false);
  });

  it('lets the grid hours average out over a total spread across days (E12)', () => {
    const turn = (day: number) =>
      event({
        id: `t${day}`,
        modelRaw: 'claude-opus-5',
        tokens: shape,
        timestamp: `2026-09-${String(day).padStart(2, '0')}T12:00:00.000Z`,
      });
    const priced = (days: number[]) =>
      days.map((day) => ({ event: turn(day), estimate: estimate(turn(day), { dataset, regionCode: 'GB' }) }));
    const spread = (range: { low: number; high: number } | null | undefined) =>
      range ? range.high / range.low : Infinity;

    // Ten days apart: carbon spreads no more than energy does.
    const month = aggregate(priced([1, 4, 7, 10, 13, 16, 19, 22, 25, 28]), 'all')[0];
    expect(spread(month?.carbonG)).toBeCloseTo(spread(month?.energyWh), 6);
    // Within one day the turns can share an hour, so the hourly spread stays.
    const day = aggregate(priced([1]), 'all')[0];
    expect(spread(day?.carbonG)).toBeGreaterThan(spread(day?.energyWh) * 1.5);
  });

  it('asks every row that publishes water or carbon directly what it counts', () => {
    for (const row of dataset.benchmarks) {
      const direct = row.perPrompt?.directWaterMl ?? row.perPrompt?.directCarbonG;
      if (direct) expect(row.perPrompt?.directScope, row.id).toBeDefined();
    }
  });

  it('a model on your own machine uses no cooling water in your kitchen', () => {
    const result = estimate(
      event({ modelRaw: 'llama-3.1-8b', hosting: 'local', tokens: shape }),
      { dataset, waterScope: 'on-site' },
    );
    expect(result.waterMl?.high).toBe(0);
  });
});

describe('carbon', () => {
  const shape = tokens({ input: 1000, output: 1000, thinking: 0 });

  it('follows the grid the user is on', () => {
    const france = estimate(event({ modelRaw: 'claude-3.7-sonnet', tokens: shape }), {
      dataset,
      regionCode: 'FR',
    });
    const india = estimate(event({ modelRaw: 'claude-3.7-sonnet', tokens: shape }), {
      dataset,
      regionCode: 'IN',
    });
    expect(india.carbonG?.central).toBeGreaterThan((france.carbonG?.central ?? 0) * 10);
  });

  it('defaults to location-based, and a provider-reported factor has to be asked for', () => {
    const standard = estimate(event({ modelRaw: 'gemini-2.5-flash', tokens: shape }), {
      dataset,
      regionCode: 'GOOGLE-FLEET',
    });
    const flattering = estimate(event({ modelRaw: 'gemini-2.5-flash', tokens: shape }), {
      dataset,
      regionCode: 'GOOGLE-FLEET',
      carbonBasis: 'provider-reported',
    });
    expect(standard.basis.carbonBasis).toBe('location-based');
    // 345 g/kWh against a market-based 94: the difference is most of the point.
    expect(standard.carbonG?.central).toBeGreaterThan((flattering.carbonG?.central ?? 0) * 3);
  });

  it('falls back to the world average and says so when no region is given', () => {
    const result = estimate(event({ modelRaw: 'claude-3.7-sonnet', tokens: shape }), { dataset });
    expect(result.basis.regionCode).toBe('WORLD');
    expect(result.basis.flags).toContain('region-default');
  });
});

describe('the basis travels with the number', () => {
  it('every estimate that has a figure also has a source', () => {
    for (const candidate of dataset.models) {
      const result = estimate(
        event({ modelRaw: candidate.id, tokens: tokens({ thinking: undefined }) }),
        { dataset },
      );
      if (result.energyWh === null && result.waterMl === null) continue;
      expect(result.basis.sources.length, candidate.id).toBeGreaterThan(0);
      for (const source of result.basis.sources) {
        expect(source.url, candidate.id).toMatch(/^https?:\/\//);
        expect(source.retrieved, candidate.id).toBeTruthy();
      }
    }
  });

  it('a proxy estimate names both the proxy and the row it was scaled from', () => {
    const result = estimate(event({ modelRaw: 'claude-opus-5' }), { dataset });
    expect(result.basis.benchmarkRowId).toBe('proxy.claude-opus');
    expect(result.basis.benchmarkParentId).toBe('jegham.claude-3.7-sonnet');
    expect(result.basis.flags).toContain('proxy-row');
    expect(result.basis.qualityScore).toBeLessThanOrEqual(2);
  });

  it('a web surface marks its input count as a lower bound', () => {
    const web = estimate(event({ surface: 'chatgpt-web', modelRaw: 'gpt-4o' }), { dataset });
    const api = estimate(event({ surface: 'api', modelRaw: 'gpt-4o' }), { dataset });
    expect(web.basis.flags).toContain('input-partial');
    expect(api.basis.flags).not.toContain('input-partial');
    expect(web.energyWh?.high).toBeGreaterThan(api.energyWh?.high ?? Infinity);
  });

  it('estimated token counts are flagged', () => {
    const result = estimate(
      event({ modelRaw: 'gpt-4o', tokens: tokens({ estimated: true, estimator: 'o200k' }) }),
      { dataset },
    );
    expect(result.basis.flags).toContain('tokens-estimated');
  });
});

describe('the ladder', () => {
  it('finds the next rung down', () => {
    expect(downgradeTarget(model('claude-opus-5'), dataset)?.id).toBe('claude-sonnet-5');
    expect(downgradeTarget(model('gpt-4.1'), dataset)?.id).toBe('gpt-4.1-mini');
  });

  it('returns nothing at the bottom of a ladder', () => {
    expect(downgradeTarget(model('claude-haiku-4.5'), dataset)).toBeNull();
  });

  it('returns nothing for a model whose ladder position we are unsure of', () => {
    expect(downgradeTarget(model('claude-fable-5.1'), dataset)).toBeNull();
  });

  it('a downgrade actually saves something', () => {
    const shape = tokens({ input: 1000, output: 1000, thinking: 0 });
    const from = model('claude-opus-5');
    const to = downgradeTarget(from, dataset);
    expect(to).not.toBeNull();
    const before = estimate(event({ modelRaw: from.id, tokens: shape }), { dataset });
    const after = estimate(event({ modelRaw: to?.id ?? '', tokens: shape }), { dataset });
    expect(after.energyWh?.central).toBeLessThan(before.energyWh?.central ?? 0);
  });
});

describe('resolving', () => {
  it('matches an alias regardless of case', () => {
    expect(resolveModel('CLAUDE-OPUS-5', dataset)?.id).toBe('claude-opus-5');
    expect(resolveModel('  Claude Opus 5  ', dataset)?.id).toBe('claude-opus-5');
  });

  it('matches the dated identifier a transcript actually writes', () => {
    expect(resolveModel('claude-haiku-4-5-20251001', dataset)?.id).toBe('claude-haiku-4.5');
  });
});

describe('thinking is charged once', () => {
  const claudeCode = (overrides: Partial<ReturnType<typeof tokens>>) =>
    event({ surface: 'claude-code', modelRaw: 'claude-opus-5', tokens: tokens({ input: 2, ...overrides }) });

  it('takes a reported count out of an output count that already holds it', () => {
    const inside = estimate(claudeCode({ output: 990, thinking: 809, thinkingInOutput: true }), { dataset });
    const visibleOnly = estimate(claudeCode({ output: 181, thinking: 809 }), { dataset });
    expect(inside.energyWh).toEqual(visibleOnly.energyWh);
    expect(inside.basis.thinkingHandling).toBe('reported');
  });

  it('adds nothing and claims no lower bound when the split was not given', () => {
    const result = estimate(claudeCode({ output: 990, thinking: null, thinkingInOutput: true }), { dataset });
    const asCounted = estimate(claudeCode({ output: 990, thinking: 0 }), { dataset });
    expect(result.energyWh).toEqual(asCounted.energyWh);
    expect(result.basis.thinkingHandling).toBe('included-in-output');
    expect(result.basis.flags).not.toContain('thinking-unknown');
    expect(result.basis.thinkingTokens).toBeNull();
  });

  it('adds nothing on top of a row whose measurement already ran the reasoning', () => {
    const undisclosed = estimate(event({ modelRaw: 'o3', tokens: tokens({ input: 200, output: 300, thinking: null }) }), { dataset });
    const none = estimate(event({ modelRaw: 'o3', tokens: tokens({ input: 200, output: 300, thinking: 0 }) }), { dataset });
    expect(undisclosed.basis.thinkingHandling).toBe('included-in-row');
    expect(undisclosed.basis.flags).not.toContain('thinking-unknown');
    expect(undisclosed.energyWh).toEqual(none.energyWh);
  });

  it('lets a proxy row inherit that from the row it scales', () => {
    const result = estimate(event({ modelRaw: 'gpt-5.6', tokens: tokens({ thinking: null }) }), { dataset });
    expect(result.basis.benchmarkRowId).toBe('proxy.gpt-5.6');
    expect(result.basis.thinkingHandling).toBe('included-in-row');
  });

  it('still estimates the thinking when neither the count nor the row holds it', () => {
    const result = estimate(event({ modelRaw: 'claude-opus-5', tokens: tokens({ thinking: null }) }), { dataset });
    expect(result.basis.thinkingHandling).toBe('estimated');
    expect(result.basis.flags).toContain('thinking-unknown');
  });
});

describe('facility overhead and water', () => {
  it('does not apply PUE again to a row that already carries it', () => {
    const result = estimate(event({ modelRaw: 'gpt-4o', tokens: tokens({ input: 200, output: 300 }) }), {
      dataset,
      at: '2026-09-01',
    });
    const row = selectBenchmark(model('gpt-4o'), dataset, { at: '2026-09-01' });
    expect(row?.energyIncludesPue).toBe(true);
    const rates = normalizeToPerToken(row!, { dataset, model: model('gpt-4o'), calibration: dataset.calibration });
    const raw = rates!.interceptWh.central + rates!.inputWh.central * 200 + rates!.outputWh.central * 300;
    expect(result.energyWh?.central).toBeCloseTo(raw, 9);
  });

  it('charges on-site water on the servers’ energy, which is the total over PUE', () => {
    const result = estimate(event({ modelRaw: 'gpt-4o', tokens: tokens({ input: 200, output: 300 }) }), {
      dataset,
      at: '2026-09-01',
      waterScope: 'on-site',
    });
    const row = selectBenchmark(model('gpt-4o'), dataset, { at: '2026-09-01' })!;
    const expected = (result.energyWh!.central / row.pue.central) * row.waterOnsiteLPerKwh!.central;
    expect(result.waterMl?.central).toBeCloseTo(expected, 9);
  });

  it('reads unknown, never zero, when the row has no on-site water figure', () => {
    const result = estimate(
      event({ modelRaw: 'deepseek-r1-distill-llama-70b', tokens: tokens({ input: 200, output: 300 }) }),
      { dataset, waterScope: 'on-site' },
    );
    expect(result.energyWh).not.toBeNull();
    expect(result.waterMl).toBeNull();
  });
});
