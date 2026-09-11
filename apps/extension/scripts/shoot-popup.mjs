/**
 * Screenshots the popup.
 *
 * The popup talks to a background worker that does not exist outside the
 * browser, so the extension API is stubbed with a fabricated summary before
 * the page scripts run. The numbers are made up; the layout, the type and the
 * colours are the real thing.
 *
 * Run with: node scripts/shoot-popup.mjs
 */

import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const built = join(root, '.output', 'chrome-mv3');
const shots = join(root, 'shots');

if (!existsSync(join(built, 'popup.html'))) {
  console.error('No build to shoot. Run: pnpm --filter @betteruseofai/extension build');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
  const path = join(built, normalize(requested).replace(/^[/\\]+/, ''));
  if (!path.startsWith(built) || !existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});

const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

/** Builds a bucket in the shape the engine really produces. */
const aggregateFor = (key, count, energy, water, carbon) => ({
  key,
  bucket: 'all',
  from: '2026-09-04T09:00:00.000Z',
  to: '2026-09-11T18:00:00.000Z',
  count,
  energyWh: energy === null ? null : { low: energy * 0.13, central: energy, high: energy * 6.7 },
  waterMl: water === null ? null : { low: water * 0.18, central: water, high: water * 9.1 },
  carbonG: carbon === null ? null : { low: carbon * 0.13, central: carbon, high: carbon * 6.7 },
  bySurface: {},
  byHosting: {},
  byModel: {},
  unknownModelCount: key === 'unknown' ? count : 0,
  noBenchmarkCount: 0,
  flags: [],
});

/** A week of fairly heavy use, with two things the popup has to admit to. */
const summary = {
  settings: {
    regionCode: 'GB',
    waterScope: 'on-site + off-site',
    carbonBasis: 'location-based',
    hintsEnabled: true,
    hasLocalModel: false,
    mutedRules: [],
    retentionDays: 180,
    localUiEnabled: false,
  },
  datasetVersion: '0.1.0',
  count: 214,
  total: {
    key: 'all',
    bucket: 'all',
    from: '2026-09-04T09:00:00.000Z',
    to: '2026-09-11T18:00:00.000Z',
    count: 214,
    energyWh: { low: 412, central: 3180, high: 21400 },
    waterMl: { low: 1840, central: 10430, high: 94600 },
    carbonG: { low: 51, central: 394, high: 2650 },
    bySurface: {},
    byHosting: {},
    byModel: {},
    // Two of these are the point of the screenshot: a lower bound and a proxy.
    unknownModelCount: 9,
    noBenchmarkCount: 0,
    flags: ['input-partial', 'proxy-row', 'thinking-unknown', 'tokens-estimated'],
  },
  byDay: [
    aggregateFor('2026-09-05', 22, 310, 1020, 38),
    aggregateFor('2026-09-06', 9, 120, 394, 15),
    aggregateFor('2026-09-07', 48, 720, 2360, 89),
    aggregateFor('2026-09-08', 31, 460, 1510, 57),
    aggregateFor('2026-09-09', 54, 810, 2660, 100),
    aggregateFor('2026-09-10', 27, 400, 1310, 50),
    aggregateFor('2026-09-11', 23, 360, 1180, 45),
  ],
  byModel: [
    aggregateFor('claude-opus-5', 128, 2100, 6900, 260),
    aggregateFor('gpt-4o', 51, 740, 2430, 92),
    aggregateFor('gemini-2.5-flash', 26, 340, 1100, 42),
    // The unrecognised one carries nulls, which is the case that has to render.
    aggregateFor('unknown', 9, null, null, null),
  ],
  bySurface: [],
  health: { 'gemini-web': { state: 'degraded', version: 1, at: '2026-09-11T18:00:00.000Z' } },
};

/** The same shape with nothing in it, for the first run. */
const empty = { ...summary, count: 0, total: null, byModel: [], health: {} };

const stubFor = (payload) => `
  const summary = ${JSON.stringify(payload)};
  const listeners = [];
  globalThis.chrome = {
    runtime: {
      sendMessage: async (message) => (message?.type === 'summary:get' ? summary : {}),
      onMessage: { addListener: (fn) => listeners.push(fn), removeListener: () => {} },
      getURL: (path) => path,
    },
    tabs: { create: async () => {} },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  };
`;

const STUB = stubFor(summary);

mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const written = [];

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.addInitScript(STUB);
  await page.goto(`http://127.0.0.1:${port}/popup.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.buoa-readout', { timeout: 5000 });
  await page.evaluate(() => document.fonts.ready);

  const name = `popup-${theme}.png`;
  await page.screenshot({ path: join(shots, name), fullPage: true });
  written.push(name);
  await context.close();
}

// And the first run, which has nothing to show and has to say so well.
for (const theme of ['light']) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 400 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.addInitScript(stubFor(empty));
  await page.goto(`http://127.0.0.1:${port}/popup.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.buoa-standby', { timeout: 5000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(shots, 'popup-first-run.png'), fullPage: true });
  written.push('popup-first-run.png');
  await context.close();
}

// The options page, where the privacy claims are made, and the dashboard.
for (const [page, selector, width] of [
  // Wait for something only the populated view renders. Both the loading and
  // the empty states carry the page's own class, so waiting on that captured
  // whichever happened to be on screen.
  ['options', '.buoa-options__section', 900],
  ['dashboard', '.buoa-dash__readouts', 1100],
]) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 2,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    const target = await context.newPage();
    await target.addInitScript(STUB);
    await target.goto(`http://127.0.0.1:${port}/${page}.html`, { waitUntil: 'networkidle' });
    await target.waitForSelector(selector, { timeout: 5000 });
    await target.evaluate(() => document.fonts.ready);
    const name = `${page}-${theme}.png`;
    await target.screenshot({ path: join(shots, name), fullPage: true });
    written.push(name);
    await context.close();
  }
}

await browser.close();
server.close();

for (const name of written) console.log(`  wrote shots/${name}`);
