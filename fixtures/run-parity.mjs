#!/usr/bin/env node
/**
 * Runs both command line tools over the same fixtures and compares the bytes.
 *
 * The JSON output is the contract between them. Everything that is allowed to
 * differ, which is the name of the implementation and the moment it ran, lives
 * in the header and is stripped before the comparison. Anything else that
 * differs is a bug in one of the two, and this script says which case and which
 * line.
 *
 * Neither tool reads a real home directory here, and neither contacts a network.
 *
 * Run with: node fixtures/run-parity.mjs
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const outDir = join(here, 'cli', 'output');

const CLAUDE_DIR = join(here, 'logs', 'claude-code');
const CODEX_DIR = join(here, 'logs', 'codex');
const LOG_FIXTURE = join(here, 'logs', 'buai-log');
const NOW = '2026-09-15T12:00:00.000Z';

/**
 * Every case is run against both tools. The clock is injected so the output is
 * the same on any day, and the directory is always a fixture.
 */
const CASES = JSON.parse(readFileSync(join(here, 'cli', 'cases.json'), 'utf8')).cases;

const substitute = (argv) =>
  argv.map((token) =>
    token
      .replace('{CLAUDE_DIR}', CLAUDE_DIR)
      .replace('{CODEX_DIR}', CODEX_DIR)
      .replace('{NOW}', NOW),
  );

/**
 * Each tool gets its own copy of the log fixture for each case. The log is
 * written as well as read, and a case such as prune changes it, so the two
 * tools must not share one and no case may see another's changes. Setting the
 * variable also switches the log on for a run that names --dir, which would
 * otherwise leave it alone.
 */
const freshLog = (tool) => {
  const dir = mkdtempSync(join(tmpdir(), `buai-parity-${tool}-`));
  for (const name of readdirSync(LOG_FIXTURE)) copyFileSync(join(LOG_FIXTURE, name), join(dir, name));
  return dir;
};

const runNode = (argv, logDir) =>
  execFileSync(process.execPath, [join(repo, 'apps', 'cli-ts', 'dist', 'cli.js'), ...argv], {
    encoding: 'utf8',
    env: { ...process.env, BUAI_CLAUDE_DIR: CLAUDE_DIR, CODEX_HOME: CODEX_DIR, BUAI_LOG_DIR: logDir },
  });

const python = process.env['BUAI_PYTHON'] ?? (process.platform === 'win32' ? 'python' : 'python3');

const runPython = (argv, logDir) =>
  execFileSync(python, ['-m', 'betteruseofai.cli', ...argv], {
    encoding: 'utf8',
    cwd: join(repo, 'apps', 'cli-py', 'src'),
    env: {
      ...process.env,
      PYTHONPATH: join(repo, 'apps', 'cli-py', 'src'),
      PYTHONIOENCODING: 'utf-8',
      BUAI_CLAUDE_DIR: CLAUDE_DIR,
      CODEX_HOME: CODEX_DIR,
      BUAI_LOG_DIR: logDir,
    },
  });

/**
 * Strips the two header fields the implementations are allowed to differ on.
 * In the dashboard file they sit inside the JSON block, so a plain text case
 * loses those two lines by pattern rather than by parsing.
 */
const normalise = (text, isJson) => {
  if (!isJson) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/^\s*"generatedAt": "[^"]*",?\n/gm, '')
      .replace(/^\s*"generatedWith": "[^"]*",?\n/gm, '');
  }
  const parsed = JSON.parse(text);
  if (parsed.header) {
    delete parsed.header.generatedWith;
    delete parsed.header.generatedAt;
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
};

mkdirSync(outDir, { recursive: true });

let failures = 0;
const results = [];

for (const testCase of CASES) {
  const argv = substitute(testCase.argv);
  const isJson = argv.includes('--json') || argv.includes('json');

  let ts;
  let py;
  try {
    ts = runNode(argv, freshLog('ts'));
  } catch (cause) {
    console.error(`\n${testCase.name}: the typescript tool failed`);
    console.error(String(cause.stderr ?? cause.message).trim());
    failures += 1;
    continue;
  }
  try {
    py = runPython(argv, freshLog('py'));
  } catch (cause) {
    console.error(`\n${testCase.name}: the python tool failed`);
    console.error(String(cause.stderr ?? cause.message).trim());
    failures += 1;
    continue;
  }

  const left = normalise(ts, isJson);
  const right = normalise(py, isJson);

  writeFileSync(join(outDir, `${testCase.name}.ts.txt`), left, 'utf8');
  writeFileSync(join(outDir, `${testCase.name}.py.txt`), right, 'utf8');

  if (left === right) {
    results.push(`  same   ${testCase.name}`);
    continue;
  }

  failures += 1;
  results.push(`  DIFFER ${testCase.name}`);

  const a = left.split('\n');
  const b = right.split('\n');
  console.error(`\n${testCase.name}: the two tools disagree`);
  console.error(`  ${relative(repo, join(outDir, `${testCase.name}.ts.txt`))}`);
  let shown = 0;
  for (let index = 0; index < Math.max(a.length, b.length) && shown < 8; index += 1) {
    if (a[index] !== b[index]) {
      shown += 1;
      console.error(`  line ${index + 1}`);
      console.error(`    typescript: ${a[index] ?? '(nothing)'}`);
      console.error(`    python:     ${b[index] ?? '(nothing)'}`);
    }
  }
}

console.log('');
for (const line of results) console.log(line);
console.log('');

if (failures > 0) {
  console.error(`${failures} of ${CASES.length} cases differ between the two implementations.\n`);
  process.exit(1);
}

console.log(`All ${CASES.length} cases produce identical output from both implementations.\n`);
