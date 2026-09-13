#!/usr/bin/env node
/**
 * Screenshots the logo sheet in both themes.
 *
 * A mark that has only been seen at the size it was drawn has not been seen,
 * so this renders logo/sheet.html, which shows every direction at six sizes,
 * on both Chrome toolbar tones, in a circular crop and beside the wordmark.
 */

import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const server = createServer((request, response) => {
  const path = join(root, normalize(decodeURIComponent((request.url ?? '/').split('?')[0])).replace(/^[/\\]+/, ''));
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

mkdirSync(join(root, 'logo'), { recursive: true });
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/logo/sheet.html`, { waitUntil: 'networkidle' });
  await page.evaluate((wanted) => {
    document.documentElement.dataset.theme = wanted;
  }, theme);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'logo', `sheet-${theme}.png`), fullPage: true });
  await context.close();
  console.log(`  wrote logo/sheet-${theme}.png`);
}
await browser.close();
server.close();
