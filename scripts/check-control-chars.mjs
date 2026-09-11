#!/usr/bin/env node
/**
 * Finds control characters that should have been escape sequences.
 *
 * This exists because it happened. A regex written through a shell heredoc
 * lost its escapes: the backreference `\1` became the byte 0x01 and the word
 * boundary `\b` became 0x08. Both are invisible in an editor, both make the
 * pattern match nothing, and the check they belonged to went on reporting
 * success while examining zero pages.
 *
 * A literal NUL inside a character range works, but it is the same hazard: the
 * next person to touch the line cannot see what is there, and an editor that
 * strips it changes the meaning silently. Write \u0000.
 *
 * Tab, newline and carriage return are fine. The ANSI escape 0x1b is fine in
 * the one file that writes colour to a terminal, and that file is named below.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const SKIP = new Set(['node_modules', '.git', 'dist', '.astro', '.turbo', 'shots', 'fonts', '.output']);
const EXTS = ['.mjs', '.js', '.ts', '.tsx', '.astro', '.css', '.json', '.yml', '.yaml', '.md', '.py'];

/** Files allowed a raw escape, with the reason. */
const ALLOWED = [
  {
    file: 'apps/cli-ts/src/output.ts',
    byte: 0x1b,
    why: 'ANSI colour codes, written straight into the terminal.',
  },
];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return EXTS.some((ext) => name.endsWith(ext)) ? [path] : [];
  });

const suspect = (code) => code < 9 || code === 11 || code === 12 || (code >= 14 && code <= 31);

const found = [];
for (const path of walk(root)) {
  const name = relative(root, path).split('\\').join('/');
  const bytes = readFileSync(path);
  const seen = new Set();
  for (const code of bytes) {
    if (!suspect(code) || seen.has(code)) continue;
    seen.add(code);
    const excused = ALLOWED.some((one) => one.file === name && one.byte === code);
    if (!excused) found.push(`${name}: byte 0x${code.toString(16).padStart(2, '0')}`);
  }
}

if (found.length > 0) {
  console.error(`${found.length} control character(s) that should be escape sequences:\n`);
  for (const one of found) console.error(`  ${one}`);
  console.error('\nWrite the escape, for example \\u0000 or \\1, rather than the raw byte.');
  process.exit(1);
}

console.log('No stray control characters.');
