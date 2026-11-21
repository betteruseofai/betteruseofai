import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Dataset } from '@betteruseofai/core';
import { describe, expect, it } from 'vitest';

import { chatgptAdapter } from '../src/adapters/index.js';
import type { CapturedTurn, SiteAdapter } from '../src/adapters/types.js';
import { fillModelFromPage } from '../src/lib/bridge.js';
import { assumedNotes, modelRowKey, modelRowName, modelRows } from '../src/lib/models.js';
import { priceTurn } from '../src/lib/pipeline.js';
import { DEFAULT_SETTINGS } from '../src/lib/storage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataset = JSON.parse(
  readFileSync(join(root, 'packages', 'dataset', 'dist', 'dataset.json'), 'utf8'),
) as Dataset;

const turn = (key: string, over: Partial<CapturedTurn> = {}): CapturedTurn => ({
  key,
  conversationId: 'conv-1',
  modelRaw: 'gpt-5.6',
  modelSource: 'response',
  inputText: 'Name three rivers in Europe.',
  outputText: 'The Danube, the Rhine and the Seine.',
  thinkingUndisclosed: false,
  at: '2026-11-16T12:00:00.000Z',
  ...over,
});

const priced = (one: CapturedTurn) => priceTurn(one, chatgptAdapter, dataset, DEFAULT_SETTINGS);

describe('model rows', () => {
  it('keeps turns whose model we assumed apart from turns that named it', async () => {
    const stored = await Promise.all([
      priced(turn('a')),
      priced(turn('b', { modelSource: 'assumed' })),
      priced(turn('c', { modelSource: 'assumed' })),
    ]);
    const rows = modelRows(stored.map(({ event, estimate }) => ({ event, estimate })));

    expect(rows.map((row) => [modelRowName(row, 'unrecognised'), row.count])).toEqual([
      ['gpt-5.6', 1],
      ['gpt-5.6, assumed', 2],
    ]);
    // Two rows for one model need two keys, or the page drops one.
    expect(new Set(rows.map(modelRowKey)).size).toBe(2);
  });

  it('names the model and the number of turns in the caveat', async () => {
    const one = await priced(turn('a', { modelSource: 'assumed' }));
    const rows = modelRows([{ event: one.event, estimate: one.estimate }]);
    expect(assumedNotes(rows, dataset)).toEqual([
      "Signed out, ChatGPT doesn't say which model answered, so we've priced that turn as GPT-⁠5.6. That's our guess, hence the ~.",
    ]);
  });

  it('says nothing when no model was assumed', async () => {
    const one = await priced(turn('a'));
    expect(assumedNotes(modelRows([{ event: one.event, estimate: one.estimate }]), dataset)).toEqual([]);
  });
});

describe('a model the page names', () => {
  const pickerSays = (label: string | null): SiteAdapter => ({
    ...chatgptAdapter,
    readSelectedModel: () => label,
  });
  const page = {} as Document;

  it('beats one we assumed', () => {
    const filled = fillModelFromPage(turn('a', { modelSource: 'assumed' }), pickerSays('gpt-4.1-mini'), page);
    expect(filled.modelRaw).toBe('gpt-4.1-mini');
    expect(filled.modelSource).toBe('picker');
  });

  it('leaves the assumption alone when the page says nothing', () => {
    const filled = fillModelFromPage(turn('a', { modelSource: 'assumed' }), pickerSays(null), page);
    expect(filled.modelSource).toBe('assumed');
  });

  it('never beats the model the answer named', () => {
    const filled = fillModelFromPage(turn('a'), pickerSays('gpt-4.1-mini'), page);
    expect(filled.modelRaw).toBe('gpt-5.6');
    expect(filled.modelSource).toBe('response');
  });
});
