import { describe, expect, it } from 'vitest';

import { estimate } from '../src/estimate.js';
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
    // Short prompt: 100 in, 300 out, published as 0.950 Wh at server level, times a PUE of 1.14.
    const result = estimate(
      event({
        modelRaw: 'claude-3.7-sonnet',
        tokens: tokens({ input: 100, output: 300, thinking: 0 }),
      }),
      { dataset },
    );
    expect(result.energyWh?.central).toBeGreaterThan(0.95);
    expect(result.energyWh?.central).toBeLessThan(1.25);
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
    const result = estimate(event({ modelRaw: 'mistral-large-2', tokens: shape }), { dataset });
    expect(result.basis.benchmarkRowId).toBe('mistral.large-2.lca.2025');
    expect(result.basis.flags).toContain('scaled-direct-figure');
    expect(result.basis.flags).toContain('no-energy-figure');
    expect(result.energyWh).toBeNull();
    expect(result.waterMl?.central).toBeGreaterThan(0);
    expect(result.carbonG?.central).toBeGreaterThan(0);
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
