#!/usr/bin/env node
/**
 * Writes tokens.css from tokens.json.
 *
 * The JSON is the source and the CSS is a build product that happens to be
 * committed, so the site and the extension can import it without a build step
 * of their own. test/contrast.test.ts regenerates it in memory and fails if the
 * committed file has drifted, which is how a hand edit to the CSS gets caught.
 *
 * The layout is kept deliberately plain: one block for the light theme, one
 * for the dark toggle, one for the dark media query, and one for reduced
 * motion. The test reads custom properties out of those blocks by name.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const lines = (values, indent = '  ') =>
  Object.entries(values)
    .filter(([name]) => !name.startsWith('$'))
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join('\n');

const prefixed = (prefix, values, indent = '  ') =>
  Object.entries(values)
    .filter(([name]) => !name.startsWith('$'))
    .map(([name, value]) => `${indent}--${prefix}${name}: ${value};`)
    .join('\n');

export const render = (tokens) => {
  const { colour, font, scale, space, layout, tempo } = tokens;

  const dark = lines(colour.dark, '  ');
  const darkMedia = lines(colour.dark, '    ');

  return `/*
 * Design tokens. Generated from tokens.json by scripts/build-tokens.mjs.
 * Edit the JSON, not this file; the test fails when the two disagree.
 *
 * Light first. The ground is a warm off-white rather than pure white, so the
 * page reads as paper and the hairlines have something to sit on. One accent,
 * a dark green, carries links, buttons and the central mark on every readout.
 * Nothing is rounded. There are no colour gradients; the hatching, the ruled
 * paper grid and the landing scrim are structure and legibility, and each one
 * is named in tokens.json under "gradients" so the test can count them. The
 * register we are after is an instrument panel, not a launch page.
 *
 * Every contrast pair below is asserted by test/contrast.test.ts. If a colour
 * drifts, that test fails rather than a comment going stale.
 */

:root {
  color-scheme: light;

  /* ground, text, the one accent, states, structure */
${lines(colour.light)}

  /* nothing is rounded */
  --radius: ${tokens.radius};

  /* type */
  --font-display: ${font.display};
  --font-body: ${font.body};
  --font-mono: ${font.mono};

  /* fluid scale, 320px to 1440px */
${lines(scale)}

  /* rhythm */
${prefixed('space-', space)}

${lines(layout)}

  /* motion, all of it short */
  --tempo-fast: ${tempo.fast};
  --tempo: ${tempo.base};
  --tempo-slow: ${tempo.slow};
  --ease: ${tempo.ease};
}

/* Dark is the secondary theme, so it inverts the roles rather than restating them. */
:root[data-theme='dark'] {
  color-scheme: dark;

${dark}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;

${darkMedia}
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --tempo-fast: 0ms;
    --tempo: 0ms;
    --tempo-slow: 0ms;
  }
}
`;
};

export const load = () => JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const css = render(load());
  writeFileSync(join(root, 'tokens.css'), css, 'utf8');
  console.log(`  tokens.css written, ${css.length} bytes`);
}
