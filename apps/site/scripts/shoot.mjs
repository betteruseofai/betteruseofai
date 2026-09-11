#!/usr/bin/env node
/**
 * Screenshots of every page, at two widths, in both themes.
 *
 * The design rules in this project are a hard rule rather than a preference,
 * and a rule nobody looks at is not a rule. So this runs against the built
 * site and writes files somebody has to open before a page is called done.
 *
 * Serves dist over the loopback address, which is the only way to see what
 * actually ships: the dev server rewrites paths and inlines styles.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const shots = join(root, 'shots');

if (!existsSync(dist)) {
  console.error('No dist folder. Run the build first.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
};

const serve = () =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let path = join(dist, decodeURIComponent(url.pathname));

      // Astro is set to build:format file, so /about is about.html.
      if (!existsSync(path) || statSync(path).isDirectory()) {
        if (existsSync(`${path}.html`)) path = `${path}.html`;
        else if (existsSync(join(path, 'index.html'))) path = join(path, 'index.html');
      }

      if (!existsSync(path) || statSync(path).isDirectory()) {
        response.writeHead(404).end('not here');
        return;
      }

      response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      createReadStream(path).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

const PAGES = [
  ['landing', '/'],
  ['methodology', '/methodology'],
  ['calculator', '/calculator'],
  ['install', '/install'],
  ['about', '/about'],
  ['local-llms', '/local-llms'],
  ['privacy', '/privacy'],
  ['changelog', '/changelog'],
  ['blog', '/blog'],
  ['post', '/blog/estimating-water-per-prompt'],
  ['design', '/design'],
  ['404', '/404'],
];

const SIZES = [
  ['1440', { width: 1440, height: 1000 }],
  ['390', { width: 390, height: 844 }],
];

const server = await serve();
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
let taken = 0;

for (const [sizeName, viewport] of SIZES) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();

    // Set before the first navigation, so the inline script in the head finds
    // it and the page never paints the wrong theme first.
    await page.addInitScript((value) => {
      try {
        localStorage.setItem('buoa-theme', value);
      } catch {
        // A context with storage blocked still screenshots, in light.
      }
    }, theme);

    for (const [name, path] of PAGES) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: join(shots, `${name}-${sizeName}-${theme}.png`),
        fullPage: true,
      });
      taken += 1;
    }

    await context.close();
  }
}

await browser.close();
server.close();

console.log(`${taken} screenshots in apps/site/shots`);
