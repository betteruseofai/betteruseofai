import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts: string[]): any => JSON.parse(readFileSync(join(root, ...parts), 'utf8'));

const models = readJson('data', 'models.json');
const benchmarks = readJson('data', 'benchmarks.json');
const regions = readJson('data', 'regions.json');
const equivalents = readJson('data', 'equivalents.json');
const calibration = readJson('data', 'calibration.json');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
ajv.addSchema(readJson('schema', 'common.schema.json'), 'common.schema.json');

// Ajv keys compiled schemas by their $id, so compile each one once and reuse it.
const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
const validateWith = (schemaName: string, value: unknown): string[] => {
  let validate = compiled.get(schemaName);
  if (!validate) {
    validate = ajv.compile(readJson('schema', `${schemaName}.schema.json`));
    compiled.set(schemaName, validate);
  }
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`);
};

describe('schema', () => {
  it.each([
    ['models', models],
    ['benchmarks', benchmarks],
    ['regions', regions],
    ['equivalents', equivalents],
    ['calibration', calibration],
  ])('%s validates', (name, value) => {
    expect(validateWith(name, value)).toEqual([]);
  });

  it('rejects a benchmark row with no source', () => {
    const row = { ...benchmarks.benchmarks[0] };
    delete row.source;
    const errors = validateWith('benchmarks', { version: '0.1.0', benchmarks: [row] });
    expect(errors.join(' ')).toContain('source');
  });

  it('rejects a per-query-set row with only one point', () => {
    const row = structuredClone(benchmarks.benchmarks.find((r: any) => r.shape === 'per-query-set'));
    row.perQuerySet.points = [row.perQuerySet.points[0]];
    expect(validateWith('benchmarks', { version: '0.1.0', benchmarks: [row] }).length).toBeGreaterThan(0);
  });

  it('rejects a proxy row with no parent', () => {
    const row = structuredClone(benchmarks.benchmarks.find((r: any) => r.shape === 'proxy'));
    delete row.proxyOf;
    expect(validateWith('benchmarks', { version: '0.1.0', benchmarks: [row] }).length).toBeGreaterThan(0);
  });
});

describe('referential integrity', () => {
  const modelIds = new Set<string>(models.models.map((m: any) => m.id));
  const rowIds = new Set<string>(benchmarks.benchmarks.map((r: any) => r.id));

  it('every benchmark row points at models that exist', () => {
    const missing = benchmarks.benchmarks.flatMap((row: any) =>
      row.modelIds.filter((id: string) => !modelIds.has(id)).map((id: string) => `${row.id} -> ${id}`),
    );
    expect(missing).toEqual([]);
  });

  it('every proxy points at a real row that is not itself a proxy', () => {
    for (const row of benchmarks.benchmarks.filter((r: any) => r.proxyOf)) {
      expect(rowIds.has(row.proxyOf), `${row.id} points at ${row.proxyOf}`).toBe(true);
      const parent = benchmarks.benchmarks.find((r: any) => r.id === row.proxyOf);
      expect(parent.shape, `${row.id} chains through a proxy`).not.toBe('proxy');
    }
  });

  it('every model can be estimated, so none silently renders as unknown', () => {
    const covered = new Set<string>(benchmarks.benchmarks.flatMap((r: any) => r.modelIds));
    expect([...modelIds].filter((id) => !covered.has(id))).toEqual([]);
  });

  it('no alias is claimed by two models', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const model of models.models) {
      for (const alias of [model.id, ...model.aliases]) {
        const key = alias.toLowerCase();
        if (owner.has(key) && owner.get(key) !== model.id) clashes.push(alias);
        owner.set(key, model.id);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('the default region is in the table', () => {
    expect(regions.regions.some((r: any) => r.code === regions.defaultRegion)).toBe(true);
  });
});

describe('ranges are ordered', () => {
  const walk = (value: any, path: string, out: string[]): void => {
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 3 && keys.every((k) => ['low', 'central', 'high'].includes(k))) {
        if (!(value.low <= value.central && value.central <= value.high)) out.push(path);
        return;
      }
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, out);
    }
  };

  it.each([
    ['models', models],
    ['benchmarks', benchmarks],
    ['regions', regions],
    ['calibration', calibration],
  ])('%s', (name, value) => {
    const bad: string[] = [];
    walk(value, name, bad);
    expect(bad).toEqual([]);
  });
});

describe('the rules that stop a number lying', () => {
  it('every model that can think carries a thinking ratio', () => {
    const offenders = models.models
      .filter((m: any) => m.reasoning && !m.thinkingRatio)
      .map((m: any) => m.id);
    expect(offenders).toEqual([]);
  });

  it('no model that cannot think carries a thinking ratio', () => {
    const offenders = models.models
      .filter((m: any) => !m.reasoning && m.thinkingRatio)
      .map((m: any) => m.id);
    expect(offenders).toEqual([]);
  });

  it('a cache hit is allowed to be free at the low end and never free at the high end', () => {
    expect(calibration.cachedReadShareOfInput.low).toBe(0);
    expect(calibration.cachedReadShareOfInput.high).toBeGreaterThan(0);
  });

  it('every proxy row is scored no better than two, because a guess is not a measurement', () => {
    for (const row of benchmarks.benchmarks.filter((r: any) => r.methodology === 'proxy')) {
      expect(row.qualityScore, row.id).toBeLessThanOrEqual(2);
    }
  });

  it('a market-based carbon figure is always labelled as one', () => {
    for (const row of benchmarks.benchmarks.filter((r: any) => r.carbonGPerKwh)) {
      expect(row.carbonBasis, row.id).toBeDefined();
    }
  });

  it('every source carries a date and a retrieval date', () => {
    const walkSources = (value: any, out: any[]): void => {
      if (value && typeof value === 'object') {
        if (value.url && value.publisher) out.push(value);
        for (const child of Object.values(value)) walkSources(child, out);
      }
    };
    const found: any[] = [];
    for (const file of [models, benchmarks, regions, equivalents, calibration]) walkSources(file, found);
    expect(found.length).toBeGreaterThan(20);
    for (const source of found) {
      expect(source.date, source.title).toBeTruthy();
      expect(source.retrieved, source.title).toBeTruthy();
    }
  });

  it('the local row has no data centre overhead and no on-site cooling water', () => {
    const local = benchmarks.benchmarks.find((r: any) => r.id === 'ecologits.parametric.local');
    expect(local.pue).toEqual({ low: 1, central: 1, high: 1 });
    expect(local.waterOnsiteLPerKwh.high).toBe(0);
  });

  it('the Google row reproduces its own published water figure from energy times WUE', () => {
    const row = benchmarks.benchmarks.find((r: any) => r.id === 'google.gemini-apps.2025-median');
    const millilitres = row.perPrompt.energyWh.central * row.waterOnsiteLPerKwh.central;
    expect(millilitres).toBeGreaterThan(0.24);
    expect(millilitres).toBeLessThan(0.3);
  });
});

describe('the built bundle', () => {
  const dist = join(root, 'dist');

  beforeAll(() => {
    if (!existsSync(join(dist, 'dataset.json'))) {
      execFileSync('npx', ['tsx', 'scripts/build.ts'], { cwd: root, shell: process.platform === 'win32' });
    }
  });

  it('carries a version and a hash of the data', () => {
    const bundle = JSON.parse(readFileSync(join(dist, 'dataset.json'), 'utf8'));
    expect(bundle.version).toBe(models.version);
    expect(bundle.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(bundle.models.length).toBe(models.models.length);
  });

  it('the generated module reports the same hash as the json', () => {
    const bundle = JSON.parse(readFileSync(join(dist, 'dataset.json'), 'utf8'));
    const js = readFileSync(join(dist, 'index.js'), 'utf8');
    expect(js).toContain(bundle.sha256);
  });

  it('every data file declares the same version', () => {
    for (const file of [models, benchmarks, regions, equivalents, calibration]) {
      expect(file.version).toBe(models.version);
    }
  });
});
