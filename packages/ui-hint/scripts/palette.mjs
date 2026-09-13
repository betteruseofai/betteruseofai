#!/usr/bin/env node
/**
 * Writes src/palette.ts from the shared tokens.
 *
 * The hint lives inside other people's pages in a shadow root, so it cannot
 * read the site's custom properties and has to carry its own colours. Those
 * used to be typed in by hand and had already started to drift. Now they are
 * copied from tokens.json at build time, and the test in test/hint.test.ts
 * fails if the committed copy is behind.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const tokens = JSON.parse(readFileSync(join(root, '..', 'tokens', 'tokens.json'), 'utf8'));

const block = (theme) =>
  Object.entries(tokens.colour[theme])
    .filter(([name]) => !name.startsWith('$'))
    .map(([name, value]) => `    '${name}': '${value}',`)
    .join('\n');

export const render = () => `/* Generated from packages/tokens/tokens.json by scripts/palette.mjs. Do not edit. */

export const PALETTE = {
  light: {
${block('light')}
  },
  dark: {
${block('dark')}
  },
} as const;

export const FONT = {
  body: ${JSON.stringify(tokens.font.body)},
  mono: ${JSON.stringify(tokens.font.mono)},
} as const;
`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(root, 'src', 'palette.ts'), render(), 'utf8');
  console.log('  src/palette.ts written from tokens.json');
}
