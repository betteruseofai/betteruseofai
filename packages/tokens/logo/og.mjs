#!/usr/bin/env node
/**
 * The picture a shared link shows: apps/site/public/og.png, 1200 by 630.
 *
 * The horizontal lockup that export.mjs writes, in ink on the light ground,
 * over the same hairline grid the site's pages sit on, with the address under
 * it. Kept apart from export.mjs so remaking it doesn't re-render every icon.
 * Run export.mjs first if the mark or the wordmark changed.
 */

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const repo = join(pkg, '..', '..');
const tokens = JSON.parse(readFileSync(join(pkg, 'tokens.json'), 'utf8'));
const light = tokens.colour.light;

const WIDTH = 1200;
const HEIGHT = 630;
/** Columns of the hairline grid, as on the site's wide pages. */
const COLUMNS = 12;

const lockup = readFileSync(join(here, 'svg', 'lockup-horizontal.svg'), 'utf8')
  .replace(/ role="img" aria-label="[^"]*"/, '')
  .replace(/ width="\d+" height="\d+"/, ' style="display:block;width:100%;height:auto"');

// The page and its fonts come from one origin. Fonts fetched from another
// origin need CORS headers, and without them the browser quietly falls back.
const TYPES = { '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
let html = '';
const server = createServer((request, response) => {
  if (request.url === '/og.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
    return;
  }
  const path = join(pkg, normalize(decodeURIComponent((request.url ?? '/').split('?')[0])).replace(/^[/\\]+/, ''));
  if (!path.startsWith(pkg) || !existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

const lines = Array.from({ length: COLUMNS - 1 }, (_, i) => {
  const x = Math.round(((i + 1) * WIDTH) / COLUMNS);
  return `<div style="position:absolute;top:0;bottom:0;left:${x}px;width:1px;background:${light.hairline}"></div>`;
}).join('');

html = `<!doctype html><html><head>
<link rel="stylesheet" href="/fonts.css">
</head><body style="margin:0">
<div style="position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${light.bg};color:${light.ink}">
  ${lines}
  <div style="position:absolute;left:0;right:0;top:${HEIGHT - 100}px;height:1px;background:${light.hairline}"></div>
  <div style="position:absolute;left:${WIDTH / COLUMNS}px;top:200px;width:${(WIDTH * 8) / COLUMNS}px;background:${light.bg};padding:24px 0">
    ${lockup}
  </div>
  <div style="position:absolute;left:${WIDTH / COLUMNS}px;top:${HEIGHT - 68}px;font-family:'IBM Plex Mono',monospace;font-size:24px;letter-spacing:0.06em;color:${light.accent}">betteruseofai.org</div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/og.html`, { waitUntil: 'load' });
await page.evaluate(() =>
  Promise.all(['800 27px "Big Shoulders"', '400 24px "IBM Plex Mono"'].map((font) => document.fonts.load(font))),
);
// Fail loudly rather than ship a picture in a fallback face.
const loaded = await page.evaluate(() =>
  ['800 27px "Big Shoulders"', '400 24px "IBM Plex Mono"'].every((font) => document.fonts.check(font)),
);
if (!loaded) throw new Error('The fonts did not load, so the picture would show a fallback face.');
const out = join(repo, 'apps', 'site', 'public', 'og.png');
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
await browser.close();
server.close();
console.log(`  wrote ${out.replace(repo, '').replace(/\\/g, '/')}`);
