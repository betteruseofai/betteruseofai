/**
 * Screenshots the design sheet at desktop and phone widths in both themes.
 *
 * The shots are committed. Judging a design system from a stylesheet does not
 * work, and a diff on a picture is the only review that catches a component
 * that has quietly gone wrong.
 *
 * Run with: node scripts/shoot.mjs
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');
const shotsDir = join(packageRoot, 'design', 'shots');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

// A local static server, because the sheet fetches tokens.json and file:// blocks that.
const server = createServer((request, response) => {
  const requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
  const relative = normalize(requested === '/' ? '/design/index.html' : requested).replace(/^[/\\]+/, '');
  const path = join(packageRoot, relative);
  if (!path.startsWith(packageRoot) || !existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});

const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const VIEWPORTS = [
  ['1440', { width: 1440, height: 900 }, 2],
  ['390', { width: 390, height: 844 }, 3],
];

mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const written = [];

for (const [label, viewport, scale] of VIEWPORTS) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: scale,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/design/index.html`, { waitUntil: 'networkidle' });
    // The sheet remembers a theme, so set it rather than trusting the default.
    await page.evaluate((wanted) => {
      localStorage.setItem('buoa-theme', wanted);
    }, theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const name = `design-${label}-${theme}.png`;
    await page.screenshot({ path: join(shotsDir, name), fullPage: true });
    written.push(name);
    await context.close();
  }
}

await browser.close();
server.close();

for (const name of written) console.log(`  wrote design/shots/${name}`);
