import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Dataset, TokenCounts, UsageEvent } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Reads the built dataset from disk.
 *
 * The tests run against the real dataset rather than a fixture, because a rule
 * that only holds for made-up rows is not worth having.
 */
export const loadDataset = (): Dataset =>
  JSON.parse(
    readFileSync(join(here, '..', '..', 'dataset', 'dist', 'dataset.json'), 'utf8'),
  ) as Dataset;

export const tokens = (overrides: Partial<TokenCounts> = {}): TokenCounts => ({
  input: 1000,
  output: 500,
  estimated: false,
  estimator: 'provider',
  ...overrides,
});

let counter = 0;

export const event = (overrides: Partial<UsageEvent> = {}): UsageEvent => {
  counter += 1;
  return {
    id: `event-${counter}`,
    surface: 'api',
    hosting: 'cloud',
    modelRaw: 'claude-opus-5',
    modelId: null,
    tokens: tokens(),
    timestamp: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
};
