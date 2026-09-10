/**
 * Regenerates fixtures/estimates/expected.json from the engine.
 *
 * The output is committed. A change to the numbers therefore shows up as a diff
 * on a reviewed file rather than as a silent drift, and the Python command line
 * tool in a later step is checked against the same file.
 *
 * Run with: pnpm --filter @betteruseofai/core fixtures
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { estimate } from '../src/estimate.js';
import { canonicalNumber } from '../src/format.js';
import type { Dataset, Estimate, EstimateOptions, Range, UsageEvent } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const fixturesDir = join(repoRoot, 'fixtures', 'estimates');

const dataset = JSON.parse(
  readFileSync(join(repoRoot, 'packages', 'dataset', 'dist', 'dataset.json'), 'utf8'),
) as Dataset;

interface Case {
  name: string;
  why: string;
  event: UsageEvent;
  options: Omit<EstimateOptions, 'dataset'>;
}

const spec = JSON.parse(readFileSync(join(fixturesDir, 'cases.json'), 'utf8')) as {
  datasetVersion: string;
  cases: Case[];
};

/** Ranges are written as canonical strings so a float printed differently cannot pass. */
const canonicalRange = (range: Range | null): Record<string, string> | null =>
  range === null
    ? null
    : {
        low: canonicalNumber(range.low),
        central: canonicalNumber(range.central),
        high: canonicalNumber(range.high),
      };

const shape = (result: Estimate) => ({
  modelId: result.modelId,
  energyWh: canonicalRange(result.energyWh),
  waterMl: canonicalRange(result.waterMl),
  carbonG: canonicalRange(result.carbonG),
  basis: {
    benchmarkRowId: result.basis.benchmarkRowId,
    benchmarkParentId: result.basis.benchmarkParentId,
    methodology: result.basis.methodology,
    boundary: result.basis.boundary,
    regionCode: result.basis.regionCode,
    thinkingHandling: result.basis.thinkingHandling,
    thinkingTokens: canonicalRange(result.basis.thinkingTokens),
    waterScope: result.basis.waterScope,
    carbonBasis: result.basis.carbonBasis,
    qualityScore: result.basis.qualityScore,
    // Sorted so the two implementations do not have to agree on discovery order.
    flags: [...result.basis.flags].sort(),
    sourceUrls: result.basis.sources.map((source) => source.url).sort(),
  },
});

export const buildExpected = (): Record<string, unknown> => {
  const results: Record<string, unknown> = {};
  for (const testCase of spec.cases) {
    results[testCase.name] = shape(estimate(testCase.event, { ...testCase.options, dataset }));
  }
  return {
    datasetVersion: dataset.version,
    datasetSha256: dataset.sha256,
    results,
  };
};

const isDirectRun = process.argv[1]?.endsWith('write-fixtures.ts');
if (isDirectRun) {
  const expected = buildExpected();
  writeFileSync(join(fixturesDir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
  console.log(`wrote ${Object.keys(expected['results'] as object).length} expected estimates`);
}
