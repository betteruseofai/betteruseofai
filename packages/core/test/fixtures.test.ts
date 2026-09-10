import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildExpected } from '../scripts/write-fixtures.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'estimates');

/**
 * The committed fixtures are the contract between the TypeScript engine and the
 * Python command line tool that lands in a later step. If the engine changes
 * what it produces, that has to show up as a diff on a reviewed file rather than
 * as a quiet drift, so this test compares against the committed copy.
 *
 * Regenerate deliberately with: pnpm --filter @betteruseofai/core fixtures
 */
describe('golden estimates', () => {
  const committed = JSON.parse(readFileSync(join(fixturesDir, 'expected.json'), 'utf8'));
  const fresh = buildExpected();

  it('match the committed file exactly', () => {
    expect(fresh).toEqual(committed);
  });

  it('were built against the dataset that is on disk now', () => {
    const dataset = JSON.parse(
      readFileSync(
        join(fixturesDir, '..', '..', 'packages', 'dataset', 'dist', 'dataset.json'),
        'utf8',
      ),
    );
    expect(committed.datasetSha256).toBe(dataset.sha256);
  });

  it('cover every flag the engine can raise on a real case', () => {
    const raised = new Set<string>();
    for (const result of Object.values(committed.results as Record<string, any>)) {
      for (const flag of result.basis.flags) raised.add(flag);
    }
    for (const expected of [
      'model-unknown',
      'thinking-unknown',
      'proxy-row',
      'region-default',
      'input-partial',
      'derived-rate',
      'assumed-token-counts',
      'parametric-rate',
      'no-energy-figure',
      'scaled-direct-figure',
      'tokens-estimated',
    ]) {
      expect(raised, `no case exercises ${expected}`).toContain(expected);
    }
  });

  it('write every number as a canonical string, so a float cannot drift past the diff', () => {
    for (const result of Object.values(committed.results as Record<string, any>)) {
      for (const key of ['energyWh', 'waterMl', 'carbonG']) {
        const value = result[key];
        if (value === null) continue;
        for (const bound of ['low', 'central', 'high']) {
          expect(typeof value[bound]).toBe('string');
        }
      }
    }
  });
});
