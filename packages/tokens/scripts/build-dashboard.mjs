#!/usr/bin/env node
/**
 * Assembles dashboard/template.html, the single file the command line tools
 * fill with data and write to disk.
 *
 * Everything the page needs is inlined: the tokens, the six font faces as
 * data URIs, the component sheet, the dashboard layout and the render script.
 * A file on somebody's disk cannot fetch a font from the site without
 * contradicting the promise on the privacy page, so it carries its own.
 *
 * The output is not committed. It is about two hundred kilobytes of mostly
 * font bytes, and the fonts are already a build product. Both command line
 * tools pick it up from here at their own build time.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'dashboard', 'src');

export const PLACEHOLDER = '__BUAI_DATA__';

/** fonts.css with every url() replaced by the file's bytes. */
const inlineFonts = () => {
  const css = readFileSync(join(root, 'fonts.css'), 'utf8');
  return css.replace(/url\('\.\/fonts\/([^']+)'\)/g, (_match, name) => {
    const file = join(root, 'fonts', name);
    if (!existsSync(file)) {
      console.error(`missing font file ${file}. Run: node scripts/copy-fonts.mjs`);
      process.exit(1);
    }
    return `url('data:font/woff2;base64,${readFileSync(file).toString('base64')}')`;
  });
};

export const render = () => {
  const template = readFileSync(join(src, 'template.html'), 'utf8');
  const css = [
    readFileSync(join(root, 'tokens.css'), 'utf8'),
    inlineFonts(),
    readFileSync(join(root, 'components.css'), 'utf8'),
    readFileSync(join(src, 'dashboard.css'), 'utf8'),
  ].join('\n');
  const js = readFileSync(join(src, 'render.js'), 'utf8');

  // A stylesheet or script that itself contained the closing tag would end the
  // element early. Neither does, and this makes sure neither ever will.
  const safe = (text, tag) => text.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

  const out = template
    .replace('/*__BUAI_CSS__*/', () => safe(css, 'style'))
    .replace('/*__BUAI_JS__*/', () => safe(js, 'script'));

  if (!out.includes(PLACEHOLDER)) {
    throw new Error(`the template lost its ${PLACEHOLDER} placeholder`);
  }
  return out;
};

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;

if (isMain) {
  const html = render();
  const outDir = join(root, 'dashboard');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'template.html');
  writeFileSync(outFile, html, 'utf8');
  console.log(`  ${String(Math.round(statSync(outFile).size / 1024)).padStart(4)} kB  dashboard/template.html`);
}
