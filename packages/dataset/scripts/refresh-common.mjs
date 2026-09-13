/**
 * What the refresh scripts share: reading and writing the data files, the
 * version bump a data-only change carries, and the changelog line that says
 * what moved. A refresh that changes nothing bumps nothing.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = join(root, 'data');
export const FILES = ['models', 'benchmarks', 'regions', 'equivalents', 'calibration'];

export const today = () => new Date().toISOString().slice(0, 10);

export const load = (name) => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'));

export const save = (name, data) => {
  writeFileSync(join(dataDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

/** Fetches with a timeout and a plain client string. Returns null on any failure. */
export const fetchText = async (url, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'betteruseofai-dataset-refresh (https://betteruseofai.org)' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * A data-only change is a minor bump, across all five files together, and a
 * line at the top of the changelog. Called once by a refresh that changed
 * something; the workflow calls it after every refresh has run, so two
 * refreshes in one week make one bump.
 */
export const bumpMinor = (changelogLines) => {
  const current = load('models').version;
  const [major, minor] = current.split('.').map(Number);
  const next = `${major}.${minor + 1}.0`;
  for (const name of FILES) {
    const data = load(name);
    if (data.version !== current) throw new Error(`${name}.json is at ${data.version}, expected ${current}`);
    data.version = next;
    save(name, data);
  }
  const path = join(root, 'CHANGELOG.md');
  const log = readFileSync(path, 'utf8');
  const entry = [`## ${next}`, '', 'Data only, refreshed by the weekly snapshot.', '', ...changelogLines.map((line) => `- ${line}`), ''].join('\n');
  writeFileSync(path, log.replace('# @betteruseofai/dataset\n', `# @betteruseofai/dataset\n\n${entry}`), 'utf8');
  return next;
};

/** Appends to the report the workflow puts in the pull request body. */
export const report = (lines) => {
  for (const line of lines) console.log(line);
  const path = process.env['SNAPSHOT_REPORT'];
  if (path) writeFileSync(path, `${lines.join('\n')}\n`, { encoding: 'utf8', flag: 'a' });
};
