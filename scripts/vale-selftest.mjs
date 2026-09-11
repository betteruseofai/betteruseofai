#!/usr/bin/env node
/**
 * Checks that the copy rules still catch the things they were written for.
 *
 * A lint that quietly stops matching is worse than no lint, because everyone
 * assumes it is working. This runs Vale over styles/test/bad-copy.md, where
 * every line is tagged with the rule it should trip, and fails if any rule in
 * styles/BUAI never fires.
 *
 * Add a rule, add a line to the fixture. That is the whole contract.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join('styles', 'test', 'bad-copy.md');

const expected = readdirSync(join(root, 'styles', 'BUAI'))
  .filter((name) => name.endsWith('.yml'))
  .map((name) => `BUAI.${name.replace(/\.yml$/, '')}`)
  .sort();

let output = '';
try {
  // Named with the extension on Windows rather than going through a shell,
  // which would concatenate the arguments instead of passing them.
  output = execFileSync(process.platform === 'win32' ? 'vale.exe' : 'vale', [
    '--output=line',
    fixture,
  ], { cwd: root, encoding: 'utf8' });
} catch (error) {
  // Vale exits non-zero when it finds anything, which is the point.
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
}

if (!output.trim()) {
  console.error('Vale produced no output at all. Is it on the path?');
  process.exit(1);
}

const fired = new Set(output.match(/BUAI\.\w+/g) ?? []);
const silent = expected.filter((rule) => !fired.has(rule));

for (const rule of expected) {
  console.log(`  ${fired.has(rule) ? 'fires' : 'SILENT'}  ${rule}`);
}

if (silent.length > 0) {
  console.error(`\n${silent.length} rule(s) matched nothing in the fixture: ${silent.join(', ')}`);
  console.error('Either the rule is broken or the fixture is missing a line for it.');
  process.exit(1);
}

console.log(`\n${expected.length} rules, all of them matching.`);
