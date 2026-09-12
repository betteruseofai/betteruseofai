#!/usr/bin/env node
/**
 * Three routes for the mark, drawn as cell grids.
 *
 * The hardest size decides the design: a 16 px favicon is about eight cells
 * across, and eight is exactly the width of the Bayer tile the dithering
 * already uses. So the mark is one tile. Every cell is a whole square, every
 * square lands on a whole pixel at 16, 48 and 128, and nothing needs a hint or
 * a special small version.
 *
 * Each route is generated from a rule rather than drawn by hand, so the
 * reasoning is in the file rather than in a pixel nobody can explain later.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const N = 8;

/** The same ordered dither the backdrop and the extension use. */
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

const threshold = (x, y) => (BAYER[(y % N) * N + (x % N)] + 0.5) / 64;

/**
 * A. The diagonal.
 *
 * Density runs from full in the top left to empty in the bottom right, passed
 * through the dither. One grid, solid at one corner and open at the other,
 * with the ordered grain visible in between. This is the project's whole
 * mechanism at eight cells.
 */
const diagonal = (x, y) => {
  // A steeper ramp than a plain average, so one corner is unambiguously solid
  // and the other unambiguously empty. The first version spread the gradient
  // so evenly that the mark read as noise at every size.
  const t = (x + y) / (2 * (N - 1));
  const density = Math.min(1, Math.max(0, 1.35 - t * 1.7));
  return density > threshold(x, y);
};

/**
 * B. The seam.
 *
 * Left is organic: a mass that thins upward, irregular. Right is ordered: a
 * lattice of pads on a fixed pitch. They meet in a dithered seam down the
 * middle. The most literal reading of nature becoming infrastructure.
 */
const seam = (x, y) => {
  // Left: a solid mass, tapering. Right: a lattice on a fixed pitch. The
  // point is that the left is unbroken and the right is regular, so the
  // crossfade between them is the only place the dither shows.
  const organic = x < 3 ? 1 : Math.max(0, 1 - (x - 2) / 3);
  const ordered = x % 2 === 1 && y % 2 === 0 ? 1 : 0;
  const across = Math.min(1, Math.max(0, (x - 2) / 3.5));
  const density = organic * (1 - across) + ordered * across;
  return density > threshold(x, y);
};

/**
 * C. The strata.
 *
 * Irregular grain at the top settling into ruled layers at the bottom: soil
 * becoming wafer, read downward. The only route with a clear up and down,
 * which is either an advantage or a liability depending on where it sits.
 */
const strata = (x, y) => {
  // Below the line: ruled layers with vias tying them together, the way a die
  // reads in cross section. Solid slabs were too blunt and swallowed the grain
  // above them.
  if (y === 5) return true;
  if (y === 6) return x % 3 === 1;
  if (y === 7) return true;
  // Above it: grain, thinning upward.
  const density = 0.82 - y * 0.14;
  return density > threshold(x, y * 3 + 1);
};

const ROUTES = [
  { id: 'a-diagonal', name: 'A. The diagonal', cells: diagonal, glyph: '▓░' },
  { id: 'b-seam', name: 'B. The seam', cells: seam, glyph: '█▒' },
  { id: 'c-strata', name: 'C. The strata', cells: strata, glyph: '▒≡' },
];

const grid = (route) => {
  const rows = [];
  for (let y = 0; y < N; y += 1) {
    const row = [];
    for (let x = 0; x < N; x += 1) row.push(route.cells(x, y) ? 1 : 0);
    rows.push(row);
  }
  return rows;
};

/**
 * One rect per filled cell, merged along each row into runs.
 *
 * Fewer paths, and it keeps every edge on a whole coordinate, which is what
 * stops a 16 px render going soft.
 */
const toSvg = (rows, { colour = 'currentColor', pad = 0 } = {}) => {
  const size = N + pad * 2;
  const parts = [];
  rows.forEach((row, y) => {
    let run = 0;
    for (let x = 0; x <= N; x += 1) {
      if (row[x] === 1) {
        run += 1;
        continue;
      }
      if (run > 0) {
        parts.push(`M${x - run + pad} ${y + pad}h${run}v1h-${run}z`);
        run = 0;
      }
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="Better Use of AI"><path fill="${colour}" d="${parts.join('')}"/></svg>\n`;
};

mkdirSync(join(here, 'svg'), { recursive: true });

const sheets = ROUTES.map((route) => {
  const rows = grid(route);
  const svg = toSvg(rows, { pad: 1 });
  writeFileSync(join(here, 'svg', `${route.id}.svg`), svg, 'utf8');
  const filled = rows.flat().filter(Boolean).length;
  return { route, rows, svg, filled };
});

// A comparison sheet, so the three can be judged at the sizes that matter
// rather than at the size they were drawn.
const swatch = (sheet, px) =>
  `<span class="shot" style="--px:${px}px">${sheet.svg.replace('<svg', '<svg class="mark"')}</span>`;

const block = (sheet) => `
  <section class="route">
    <h2>${sheet.route.name}</h2>
    <p class="meta">${sheet.filled} of 64 cells filled &middot; terminal: <b>${sheet.route.glyph}</b></p>
    <div class="sizes">
      ${[16, 24, 32, 48, 64, 128].map((px) => `<div><span class="label">${px}</span>${swatch(sheet, px)}</div>`).join('')}
    </div>
    <pre class="ascii">${sheet.rows.map((row) => row.map((on) => (on ? '██' : '··')).join('')).join('\n')}</pre>
  </section>`;

/*
 * One page, screenshotted twice with data-theme set on the root element.
 *
 * The first version put data-theme on a div, and tokens.css defines the dark
 * palette on :root, so the dark half was rendering the light palette against a
 * dark rectangle. It looked like the marks disappeared in dark; they had never
 * been drawn in dark at all.
 */
const page = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Marks</title>
<link rel="stylesheet" href="../tokens.css"><link rel="stylesheet" href="../fonts.css">
<style>
  body { margin:0; font-family:var(--font-body); background:var(--bg); color:var(--ink); }
  .sheet { max-width:1100px; margin:0 auto; padding:2rem 1.5rem 3rem; }
  h1 { font-family:var(--font-display); text-transform:uppercase; font-size:2.4rem; margin:0 0 .4rem; }
  h2 { font-family:var(--font-mono); font-size:.85rem; letter-spacing:.16em; text-transform:uppercase; margin:0 0 .3rem; }
  .meta { font-family:var(--font-mono); font-size:.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin:0 0 1rem; }
  .route { border-top:1px solid var(--hairline); padding:1.4rem 0; }
  .sizes { display:flex; gap:1.6rem; align-items:flex-end; flex-wrap:wrap; }
  .label { display:block; font-family:var(--font-mono); font-size:.65rem; color:var(--muted); margin-bottom:.4rem; }
  .mark { width:var(--px); height:var(--px); color:var(--ink); display:block; }
  .onaccent { background:var(--accent); padding:.5rem; display:inline-block; }
  .onaccent .mark { color:var(--bg); }
  .ascii { font-family:var(--font-mono); font-size:.6rem; line-height:1; color:var(--hairline); margin:1rem 0 0; }
</style></head>
<body><div class="sheet"><h1>Three marks</h1>${sheets.map(block).join('')}</div></body></html>`;

writeFileSync(join(here, 'sheet.html'), page, 'utf8');
console.log(`${sheets.length} marks in packages/tokens/logo/svg, sheet at logo/sheet.html`);
for (const sheet of sheets) console.log(`  ${sheet.route.id.padEnd(12)} ${sheet.filled}/64 cells`);
