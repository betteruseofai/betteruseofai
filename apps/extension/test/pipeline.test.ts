import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Dataset } from '@betteruseofai/core';
import { describe, expect, it } from 'vitest';

import { claudeAdapter, localAdapter } from '../src/adapters/index.js';
import type { CapturedTurn } from '../src/adapters/types.js';
import { countTokens, priceTurn, reconcile, reprice, toEvent } from '../src/lib/pipeline.js';
import { DEFAULT_SETTINGS } from '../src/lib/storage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataset = JSON.parse(
  readFileSync(join(root, 'packages', 'dataset', 'dist', 'dataset.json'), 'utf8'),
) as Dataset;

const turn = (over: Partial<CapturedTurn> = {}): CapturedTurn => ({
  key: 'conv-1:3',
  conversationId: 'conv-1',
  modelRaw: 'claude-opus-5',
  modelSource: 'response',
  inputText: 'Rewrite this paragraph so it reads more plainly and loses the jargon.',
  outputText: 'Published measurements of AI energy use disagree by an order of magnitude.',
  thinkingUndisclosed: false,
  at: '2026-09-10T12:00:00.000Z',
  ...over,
});

describe('counting a turn', () => {
  it('estimates when the site says nothing, and says the counts are estimates', async () => {
    const counts = await countTokens(turn(), claudeAdapter, dataset);
    expect(counts.estimated).toBe(true);
    expect(counts.estimator).toContain('anthropic');
    expect(counts.input).toBeGreaterThan(5);
    expect(counts.output).toBeGreaterThan(5);
  });

  it('takes a reported count over an estimate, and stops calling it an estimate', async () => {
    const counts = await countTokens(
      turn({ reportedTokens: { input: 412, output: 96, cachedRead: 8100 } }),
      claudeAdapter,
      dataset,
    );
    expect(counts.input).toBe(412);
    expect(counts.output).toBe(96);
    expect(counts.cachedRead).toBe(8100);
    expect(counts.estimated).toBe(false);
    expect(counts.estimator).toBe('provider');
  });

  it('keeps the three states of a thinking count apart', async () => {
    // Reported: use it.
    const reported = await countTokens(
      turn({ reportedTokens: { input: 1, output: 1, thinking: 240 } }),
      claudeAdapter,
      dataset,
    );
    expect(reported.thinking).toBe(240);

    // It thought and did not say: null, which becomes a range from zero.
    const undisclosed = await countTokens(turn({ thinkingUndisclosed: true }), claudeAdapter, dataset);
    expect(undisclosed.thinking).toBeNull();

    // It cannot think: undefined, the one case where nothing is right.
    const cannot = await countTokens(turn({ thinkingUndisclosed: false }), claudeAdapter, dataset);
    expect(cannot.thinking).toBeUndefined();
  });

  it('takes the exact counts a local server reports', async () => {
    const counts = await countTokens(
      turn({ modelRaw: 'llama3.1:8b', reportedTokens: { input: 17, output: 6 } }),
      localAdapter,
      dataset,
    );
    expect(counts.estimated).toBe(false);
    expect(counts.input).toBe(17);
  });
});

describe('turning a turn into an event', () => {
  it('keeps an unrecognised model string verbatim, so it can be reported', async () => {
    const event = await toEvent(turn({ modelRaw: 'claude-opus-99' }), claudeAdapter, dataset);
    expect(event.modelRaw).toBe('claude-opus-99');
    // Never resolved here. The engine decides, and it is allowed to say no.
    expect(event.modelId).toBeNull();
  });

  it('records where the model name came from, because that decides how much to trust it', async () => {
    const fromResponse = await toEvent(turn({ modelSource: 'response' }), claudeAdapter, dataset);
    const fromPicker = await toEvent(turn({ modelSource: 'picker' }), claudeAdapter, dataset);
    expect(fromResponse.meta?.['modelSource']).toBe('response');
    expect(fromPicker.meta?.['modelSource']).toBe('picker');
  });

  it('carries no prompt text anywhere in the event', async () => {
    const event = await toEvent(turn(), claudeAdapter, dataset);
    const serialised = JSON.stringify(event);
    expect(serialised).not.toContain('Rewrite this paragraph');
    expect(serialised).not.toContain('order of magnitude');
  });
});

describe('pricing a turn', () => {
  it('produces a stored event with an estimate and a day', async () => {
    const stored = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    expect(stored.id).toBe('claude-web:conv-1:3');
    expect(stored.day).toBe('2026-09-10');
    expect(stored.estimate.energyWh?.central).toBeGreaterThan(0);
    expect(stored.datasetVersion).toBe(dataset.version);
  });

  it('gives an unrecognised model nulls, not zeroes', async () => {
    const stored = await priceTurn(
      turn({ modelRaw: 'something-nobody-has-heard-of' }),
      claudeAdapter,
      dataset,
      DEFAULT_SETTINGS,
    );
    expect(stored.estimate.energyWh).toBeNull();
    expect(stored.estimate.basis.flags).toContain('model-unknown');
  });

  it('marks a web turn as a lower bound on its input, because the system prompt is hidden', async () => {
    const stored = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    expect(stored.estimate.basis.flags).toContain('input-partial');
  });

  it('follows the region and water scope from settings', async () => {
    const india = await priceTurn(turn(), claudeAdapter, dataset, {
      ...DEFAULT_SETTINGS,
      regionCode: 'IN',
    });
    const france = await priceTurn(turn(), claudeAdapter, dataset, {
      ...DEFAULT_SETTINGS,
      regionCode: 'FR',
    });
    expect(india.estimate.carbonG?.central).toBeGreaterThan(
      (france.estimate.carbonG?.central ?? 0) * 5,
    );
  });

  it('gives the same turn the same id twice, so a repeat replaces rather than doubles', async () => {
    const first = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    const second = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    expect(second.id).toBe(first.id);
  });
});

describe('re-pricing after a dataset update', () => {
  it('re-prices only what is out of date, and says how much moved', async () => {
    const stored = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    const stale = { ...stored, datasetVersion: '0.0.1' };

    const { updated, changed } = reprice([stored, stale], dataset, DEFAULT_SETTINGS);
    expect(changed).toBe(1);
    expect(updated.every((one) => one.datasetVersion === dataset.version)).toBe(true);
  });

  it('needs no prompt text to do it, because the tokens were kept', async () => {
    const stored = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    const { updated } = reprice([{ ...stored, datasetVersion: '0.0.1' }], dataset, DEFAULT_SETTINGS);
    expect(updated[0]?.estimate.energyWh?.central).toBeCloseTo(
      stored.estimate.energyWh?.central ?? 0,
      10,
    );
  });
});

describe('the network and the page seeing the same turn', () => {
  it('prefers the network, which knows the model and sometimes the counts', async () => {
    const fromNetwork = await priceTurn(turn(), claudeAdapter, dataset, DEFAULT_SETTINGS);
    const fromPage = await priceTurn(
      turn({ modelRaw: null, modelSource: 'picker' }),
      claudeAdapter,
      dataset,
      DEFAULT_SETTINGS,
    );
    expect(reconcile(fromNetwork, fromPage)).toBe(fromNetwork);
    expect(reconcile(undefined, fromPage)).toBe(fromPage);
    expect(reconcile(undefined, undefined)).toBeNull();
  });
});
