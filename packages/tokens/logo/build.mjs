#!/usr/bin/env node
/**
 * Three directions for the mark, drawn by hand as monoline SVG.
 *
 * The three cell-grid routes of 2026-09-12 (now under superseded/) put the
 * project's dither mechanism at eight cells and read as texture rather than as
 * a mark. These are drawn as shapes instead, each one form that reads two ways,
 * which is the whole brand: nature and silicon on one geometry.
 *
 * Sixteen pixels first. Every direction is designed on a 16 unit box with a
 * 1.5 unit stroke, so the toolbar icon is the drawing and every larger size is
 * the same drawing scaled. Strokes sit on half units where a horizontal or
 * vertical run needs to land on whole pixels at 16.
 *
 * The SVG uses currentColor, so one file is the mark in ink on paper, in paper
 * on ink, in the toolbar mid-tone, and in the accent on a button. The sheet
 * renders each direction at six sizes in both themes, on both Chrome toolbar
 * tones in the mid-tone colour, and inside a circular crop with the two-cell
 * margin the avatar export uses.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, '..', 'tokens.json'), 'utf8'));

const STROKE = 1.5;

/** Wraps a body in the 16 unit frame the three share. */
const frame = (body, { pad = 0, title }) => {
  const size = 16 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${size} ${size}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Better Use of AI, ${title}">
${body}
</svg>
`;
};

/*
 * A. The wafer.
 *
 * Two rings and a centre around one point, with a flat cut across the bottom
 * of the outer ring. A ripple where a drop landed, a tree's rings, and a
 * silicon wafer, which has that flat edge so a machine can tell which way it
 * is facing. The flat is the whole tell: without it this is any set of rings;
 * with it, it is a wafer to anyone who has seen one and a still pond to anyone
 * who has not.
 */
const wafer = `  <path d="M3.9 12.5 A6.25 6.25 0 1 1 12.1 12.5 Z" />
  <circle cx="8" cy="8" r="3.1" />
  <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />`;

/*
 * B. The die.
 *
 * A square with one corner drawn to a point, and inside it a midrib running to
 * that point with veins leaving it at right angles. The outline is a die, and
 * the point is where a leaf ends; the veins are the venation of the leaf and
 * the routing of the chip, and they are the same lines. Read the square first
 * and it is a floorplan. Read the point first and it is a leaf.
 */
const die = `  <path d="M2.5 5.5 V13.5 H10.5 L13.5 10.5 V2.5 H5.5 Z" />
  <path d="M3.5 12.5 L12.6 3.4" />
  <path d="M6 10 L6 7.5 M8 8 L8 5 M10 6 L10 4.5" />
  <path d="M6 10 L8.5 10 M8 8 L11 8 M10 6 L11.5 6" />`;

/*
 * C. The delta.
 *
 * One stem that divides into three channels at forty-five degrees, each
 * ending in a pad. A river reaching the sea, and the fan-out from a single pin
 * on a board, drawn with the same turns. It is the most literal statement of
 * one thing feeding many, which is what a prompt does on the way to a data
 * centre.
 */
const delta = `  <path d="M8 14.5 V9.5" />
  <path d="M8 9.5 L4.5 6 V3.5 M8 9.5 V3.5 M8 9.5 L11.5 6 V3.5" />
  <circle cx="4.5" cy="2.5" r="1" fill="currentColor" stroke="none" />
  <circle cx="8" cy="2.5" r="1" fill="currentColor" stroke="none" />
  <circle cx="11.5" cy="2.5" r="1" fill="currentColor" stroke="none" />`;

export const DIRECTIONS = [
  {
    id: 'a-wafer',
    name: 'A. The wafer',
    body: wafer,
    glyph: '◎',
    ascii: '(o)',
    line: 'Rings around one point with a wafer flat across the bottom: a ripple, tree rings and a silicon wafer at once, and round enough to survive any crop.',
  },
  {
    id: 'b-die',
    name: 'B. The die',
    body: die,
    glyph: '◩',
    ascii: '[/]',
    line: 'A die with one corner drawn to a leaf tip, and a midrib whose veins leave at right angles: venation that is also routing.',
  },
  {
    id: 'c-delta',
    name: 'C. The delta',
    body: delta,
    glyph: 'ʸ',
    ascii: '\\|/',
    line: 'One stem dividing into three channels at forty-five degrees, each ending in a pad: a river delta and fan-out from a single pin.',
  },
];

mkdirSync(join(here, 'svg'), { recursive: true });

for (const direction of DIRECTIONS) {
  writeFileSync(join(here, 'svg', `${direction.id}.svg`), frame(direction.body, { title: direction.name }), 'utf8');
  // The avatar export: a two unit margin so the circle a service crops to
  // clears every stroke.
  writeFileSync(join(here, 'svg', `${direction.id}-avatar.svg`), frame(direction.body, { pad: 2, title: direction.name }), 'utf8');
}

// --------------------------------------------------------------- the sheet

const light = tokens.colour.light;
const dark = tokens.colour.dark;
const inline = (direction, pad = 0) => frame(direction.body, { pad, title: direction.name }).replace('<svg', '<svg class="mark"');

const sizes = [16, 24, 32, 48, 64, 128];

const block = (direction) => `
  <section class="route">
    <h2>${direction.name}</h2>
    <p class="line">${direction.line}</p>
    <div class="row">
      ${sizes.map((px) => `<div class="cell"><span class="label">${px}</span><span class="shot" style="--px:${px}px">${inline(direction)}</span></div>`).join('')}
      <div class="cell"><span class="label">terminal</span><span class="glyph">${direction.glyph}</span><span class="glyph ascii">${direction.ascii}</span></div>
    </div>
    <div class="row contexts">
      <div class="cell"><span class="label">chrome light toolbar</span><span class="toolbar toolbar--light"><span class="shot" style="--px:16px">${inline(direction)}</span><span class="shot" style="--px:16px">${inline(direction)}</span></span></div>
      <div class="cell"><span class="label">chrome dark toolbar</span><span class="toolbar toolbar--dark"><span class="shot" style="--px:16px">${inline(direction)}</span><span class="shot" style="--px:16px">${inline(direction)}</span></span></div>
      <div class="cell"><span class="label">avatar crop, 2 unit margin</span><span class="avatar"><span class="shot" style="--px:64px">${inline(direction, 2)}</span></span></div>
      <div class="cell"><span class="label">on the accent</span><span class="onaccent"><span class="shot" style="--px:32px">${inline(direction)}</span></span></div>
      <div class="cell"><span class="label">readme header</span><span class="header"><span class="shot" style="--px:28px">${inline(direction)}</span><span class="wordmark">Better Use of AI</span></span></div>
    </div>
  </section>`;

const page = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Three directions for the mark</title>
<link rel="stylesheet" href="../tokens.css"><link rel="stylesheet" href="../fonts.css">
<style>
  body { margin:0; font-family:var(--font-body); background:var(--bg); color:var(--ink); }
  .sheet { max-width:1180px; margin:0 auto; padding:2rem 1.5rem 3rem; }
  h1 { font-family:var(--font-display); text-transform:uppercase; font-size:2.4rem; margin:0 0 .4rem; }
  .intro { max-width:62ch; color:var(--ink-2); margin:0 0 1.5rem; }
  h2 { font-family:var(--font-mono); font-size:.85rem; letter-spacing:.16em; text-transform:uppercase; margin:0 0 .3rem; }
  .line { max-width:62ch; margin:0 0 1rem; color:var(--ink-2); font-size:.95rem; }
  .route { border-top:1px solid var(--hairline); padding:1.4rem 0; }
  .row { display:flex; gap:1.6rem; align-items:flex-end; flex-wrap:wrap; margin-bottom:1rem; }
  .cell { display:grid; gap:.4rem; justify-items:start; }
  .label { font-family:var(--font-mono); font-size:.65rem; color:var(--muted); letter-spacing:.08em; text-transform:uppercase; }
  .shot { display:inline-block; width:var(--px); height:var(--px); }
  .mark { width:100%; height:100%; display:block; color:var(--ink); }
  .glyph { font-family:var(--font-mono); font-size:1.6rem; line-height:1; color:var(--ink); }
  .ascii { font-size:1rem; color:var(--muted); }
  /* Chrome's toolbar tones, and the mid-tone the icon ships in. */
  .toolbar { display:inline-flex; gap:12px; padding:8px 12px; align-items:center; }
  .toolbar--light { background:#f1f3f4; }
  .toolbar--dark { background:#202124; }
  .toolbar .shot:first-child .mark { color:${light.muted}; }
  .toolbar .shot:last-child .mark { color:${light.accent}; }
  .toolbar--dark .shot:first-child .mark { color:${dark.muted}; }
  .toolbar--dark .shot:last-child .mark { color:${dark.accent}; }
  .avatar { display:inline-block; width:64px; height:64px; border-radius:50%; overflow:hidden; background:var(--bg-sunken); }
  .avatar .shot { display:block; }
  .onaccent { display:inline-block; background:var(--accent); padding:8px; }
  .onaccent .mark { color:var(--bg); }
  .header { display:inline-flex; align-items:center; gap:.6rem; }
  .wordmark { font-family:var(--font-display); font-weight:800; text-transform:uppercase; font-size:1.5rem; letter-spacing:.02em; }
</style></head>
<body><div class="sheet">
  <h1>Three directions</h1>
  <p class="intro">Each is one form that reads two ways. Drawn at sixteen pixels with a 1.5 unit stroke, and shown at the sizes that matter: the toolbar in both Chrome tones, a circular crop, the accent, and a README header. Nothing here is chosen yet.</p>
  ${DIRECTIONS.map(block).join('')}
</div></body></html>`;

writeFileSync(join(here, 'sheet.html'), page, 'utf8');
console.log(`${DIRECTIONS.length} directions in packages/tokens/logo/svg, sheet at logo/sheet.html`);
