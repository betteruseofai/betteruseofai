#!/usr/bin/env node
/**
 * Prints each page's own weight into its footer.
 *
 * A page that argues about the cost of computation should say what it costs
 * to fetch. Astro cannot know that while it renders, because the hashed asset
 * names and their sizes only exist once the build is done, so this runs after
 * the build, weighs every page the way a browser would fetch it, and writes
 * the figure into the placeholder the footer left for it.
 *
 * The measure is transfer: HTML, CSS and script compressed, fonts as they are,
 * since woff2 is already compressed. The same arithmetic as the budget test in
 * tests/site.test.ts, so the footer and the test cannot disagree.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

const pages = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name.endsWith('.html') ? [path] : [];
  });

const PLACEHOLDER = /(<span class="buai-metastrip__item" data-page-weight>)([^<]*)(<\/span>)/;

/** Bytes over the wire for one page, as the budget test counts them. */
export const weigh = (html) => {
  const referenced = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+|\/theme\.js)"/g)].map((m) => m[1]);
  const unique = new Set(referenced);

  // Fonts are referenced from the stylesheet, not the page, so read them out
  // of every stylesheet the page loads before summing anything.
  for (const asset of referenced) {
    if (!asset.endsWith('.css')) continue;
    const path = join(dist, asset);
    if (!existsSync(path)) continue;
    for (const match of readFileSync(path, 'utf8').matchAll(/\/_astro\/[^"'()\s]+\.woff2/g)) {
      unique.add(match[0]);
    }
  }

  let total = gzipSync(Buffer.from(html)).length;
  for (const asset of unique) {
    const path = join(dist, asset);
    if (!existsSync(path)) continue;
    // Fonts and images are already compressed; everything else travels gzipped.
    total += /\.(woff2|png|jpe?g)$/.test(asset)
      ? statSync(path).size
      : gzipSync(readFileSync(path)).length;
  }
  return total;
};

let written = 0;
for (const file of pages(dist)) {
  const html = readFileSync(file, 'utf8');
  if (!PLACEHOLDER.test(html)) continue;
  const kb = Math.round(weigh(html) / 1024);
  writeFileSync(file, html.replace(PLACEHOLDER, `$1${kb} kB over the wire$3`), 'utf8');
  written += 1;
  if (relative(dist, file) === 'index.html') console.log(`  landing page: ${kb} kB over the wire`);
}
console.log(`  weighed ${written} pages`);
