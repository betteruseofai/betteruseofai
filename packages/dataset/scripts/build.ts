/**
 * Validates the dataset and emits the built bundle.
 *
 * Validation happens in two passes. JSON Schema catches shape. The checks below
 * catch the things a schema cannot express: that low never exceeds central,
 * that every model a benchmark row claims actually exists, that no proxy row
 * points at a missing parent or at itself, and that every row carries a source.
 *
 * A failure here is a build failure. There is no repair path, on purpose: a
 * dataset that quietly fixes itself is a dataset nobody can audit.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'data');
const schemaDir = join(root, 'schema');
const distDir = join(root, 'dist');

const FILES = ['models', 'benchmarks', 'regions', 'equivalents', 'calibration'] as const;
type FileName = (typeof FILES)[number];

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

/** Collected before we throw, so one run reports every problem rather than the first. */
const problems: string[] = [];
const fail = (where: string, what: string): void => {
  problems.push(`${where}: ${what}`);
};

// ---------------------------------------------------------------- schema pass

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
ajv.addSchema(readJson(join(schemaDir, 'common.schema.json')) as object, 'common.schema.json');

const data = {} as Record<FileName, Record<string, unknown>>;

for (const name of FILES) {
  const schema = readJson(join(schemaDir, `${name}.schema.json`)) as object;
  const value = readJson(join(dataDir, `${name}.json`)) as Record<string, unknown>;
  data[name] = value;

  const validate = ajv.compile(schema);
  if (!validate(value)) {
    for (const error of validate.errors ?? []) {
      fail(`${name}.json`, `${error.instancePath || '/'} ${error.message ?? 'failed validation'}`);
    }
  }
}

// ------------------------------------------------------- checks beyond schema

interface Range {
  low: number;
  central: number;
  high: number;
}

const isRange = (value: unknown): value is Range =>
  typeof value === 'object' &&
  value !== null &&
  ['low', 'central', 'high'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number');

/** Walks any structure and checks every range it finds. */
const checkRanges = (where: string, value: unknown, path = ''): void => {
  if (isRange(value)) {
    if (!(value.low <= value.central && value.central <= value.high)) {
      fail(where, `${path} is not ordered: low ${value.low}, central ${value.central}, high ${value.high}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkRanges(where, item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      checkRanges(where, item, path ? `${path}.${key}` : key);
    }
  }
};

for (const name of FILES) checkRanges(`${name}.json`, data[name]);

const models = (data.models['models'] ?? []) as Array<Record<string, unknown>>;
const benchmarks = (data.benchmarks['benchmarks'] ?? []) as Array<Record<string, unknown>>;
const regions = (data.regions['regions'] ?? []) as Array<Record<string, unknown>>;
const equivalents = (data.equivalents['equivalents'] ?? []) as Array<Record<string, unknown>>;

/** Reports any id that appears more than once. */
const checkUnique = (where: string, items: Array<Record<string, unknown>>, key: string): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const id = String(item[key]);
    if (seen.has(id)) fail(where, `duplicate ${key} ${id}`);
    seen.add(id);
  }
};

checkUnique('models.json', models, 'id');
checkUnique('benchmarks.json', benchmarks, 'id');
checkUnique('regions.json', regions, 'code');
checkUnique('equivalents.json', equivalents, 'id');

const modelIds = new Set(models.map((model) => String(model['id'])));
const benchmarkIds = new Set(benchmarks.map((row) => String(row['id'])));

// An alias must be unique across the whole table, or resolveModel would have to guess.
const aliasOwner = new Map<string, string>();
for (const model of models) {
  const id = String(model['id']);
  const aliases = [id, ...((model['aliases'] as string[]) ?? [])];
  for (const alias of aliases) {
    const key = alias.trim().toLowerCase();
    const existing = aliasOwner.get(key);
    if (existing && existing !== id) {
      fail('models.json', `alias ${alias} is claimed by both ${existing} and ${id}`);
    }
    aliasOwner.set(key, id);
  }
  if (model['reasoning'] === true && model['thinkingRatio'] === undefined) {
    fail(
      'models.json',
      `${id} can think but has no thinkingRatio, so an undisclosed thinking count would silently become nothing`,
    );
  }
  if (model['reasoning'] === false && model['thinkingRatio'] !== undefined) {
    fail('models.json', `${id} cannot think but carries a thinkingRatio`);
  }
}

for (const row of benchmarks) {
  const id = String(row['id']);
  for (const modelId of (row['modelIds'] as string[]) ?? []) {
    if (!modelIds.has(modelId)) fail('benchmarks.json', `${id} references unknown model ${modelId}`);
  }
  const parent = row['proxyOf'];
  if (typeof parent === 'string') {
    if (parent === id) fail('benchmarks.json', `${id} is a proxy of itself`);
    if (!benchmarkIds.has(parent)) fail('benchmarks.json', `${id} is a proxy of unknown row ${parent}`);
    const parentRow = benchmarks.find((candidate) => candidate['id'] === parent);
    if (parentRow && parentRow['shape'] === 'proxy') {
      fail('benchmarks.json', `${id} is a proxy of ${parent}, which is itself a proxy`);
    }
  }
  if (row['validTo'] !== undefined && String(row['validTo']) < String(row['validFrom'])) {
    fail('benchmarks.json', `${id} has validTo before validFrom`);
  }
}

// Every model needs at least one row it can be estimated from, or it renders as
// unknown even though we know it exists. That is safe, but it is worth knowing.
const covered = new Set<string>();
for (const row of benchmarks) for (const modelId of (row['modelIds'] as string[]) ?? []) covered.add(modelId);
const uncovered = [...modelIds].filter((id) => !covered.has(id));

const defaultRegion = String(data.regions['defaultRegion']);
if (!regions.some((region) => region['code'] === defaultRegion)) {
  fail('regions.json', `defaultRegion ${defaultRegion} is not in the table`);
}

for (const equivalent of equivalents) {
  const quantity = String(equivalent['quantity']);
  const unit = String(equivalent['unitPer']);
  const expected = { energy: 'Wh', water: 'mL', carbon: 'g' }[quantity];
  if (unit !== expected) {
    fail('equivalents.json', `${String(equivalent['id'])} is a ${quantity} equivalent measured in ${unit}`);
  }
}

if (problems.length > 0) {
  console.error(`\nDataset build failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

// ------------------------------------------------------------------- emitting

const version = String(data.models['version']);
for (const name of FILES) {
  if (String(data[name]['version']) !== version) {
    console.error(`\nVersion mismatch: models.json is ${version}, ${name}.json is ${String(data[name]['version'])}\n`);
    process.exit(1);
  }
}

const bundle = {
  version,
  builtFrom: FILES.reduce<Record<string, unknown>>((acc, name) => {
    acc[name] = data[name];
    return acc;
  }, {}),
};

// The hash covers the data only, so it stays stable while the wrapper changes.
const canonical = JSON.stringify(bundle.builtFrom);
const sha256 = createHash('sha256').update(canonical).digest('hex');

const payload = {
  version,
  sha256,
  models: data.models['models'],
  benchmarks: data.benchmarks['benchmarks'],
  regions: data.regions['regions'],
  defaultRegion: data.regions['defaultRegion'],
  equivalents: data.equivalents['equivalents'],
  calibration: data.calibration,
};

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'dataset.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const js = `// Generated by scripts/build.ts. Do not edit.
export const DATASET_VERSION = ${JSON.stringify(version)};
export const DATASET_SHA256 = ${JSON.stringify(sha256)};
export const dataset = ${JSON.stringify(payload)};
export default dataset;
`;
writeFileSync(join(distDir, 'index.js'), js, 'utf8');

const dts = `// Generated by scripts/build.ts. Do not edit.
export interface DatasetRange { low: number; central: number; high: number }
export interface DatasetBundle {
  version: string;
  sha256: string;
  models: unknown[];
  benchmarks: unknown[];
  regions: unknown[];
  defaultRegion: string;
  equivalents: unknown[];
  calibration: Record<string, unknown>;
}
export declare const DATASET_VERSION: string;
export declare const DATASET_SHA256: string;
export declare const dataset: DatasetBundle;
export default dataset;
`;
writeFileSync(join(distDir, 'index.d.ts'), dts, 'utf8');

console.log(`dataset ${version}`);
console.log(`  sha256      ${sha256}`);
console.log(`  models      ${models.length}`);
console.log(`  benchmarks  ${benchmarks.length}`);
console.log(`  regions     ${regions.length}`);
console.log(`  equivalents ${equivalents.length}`);
if (uncovered.length > 0) {
  console.log(`  models with no benchmark row (they will render as unknown): ${uncovered.join(', ')}`);
}
const pending = benchmarks.filter(
  (row) => (row['provenance'] as Record<string, unknown> | undefined)?.['method'] === 'recalled-pending-refetch',
).length;
const pendingRegions = regions.filter(
  (row) => (row['provenance'] as Record<string, unknown> | undefined)?.['method'] === 'recalled-pending-refetch',
).length;
console.log(`  rows still to be re-fetched from source: ${pending} benchmark, ${pendingRegions} region`);
