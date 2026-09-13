#!/usr/bin/env node
/**
 * Exports the chosen mark to every place it is used.
 *
 * The SVG is the source; everything here is rendered from it at an exact pixel
 * size by a headless browser, which the repository already depends on for its
 * screenshots. No image library is added for a handful of small files.
 *
 * What comes out:
 *
 *   apps/extension/public/icon/{16,32,48,128}.png        Chrome, in the toolbar tone
 *   apps/extension/public/icon/{size}-ink.png, -paper.png Firefox theme_icons
 *   apps/site/public/favicon.svg                          follows prefers-color-scheme
 *   apps/site/public/favicon-32.png                       the toolbar tone, for browsers without SVG favicons
 *   apps/site/public/apple-touch-icon.png                 180 px, ink on the ground
 *   logo/svg/lockup-horizontal.svg, lockup-stacked.svg    mark plus wordmark, in Big Shoulders
 *   logo/png/lockup-*.png                                 the same at 2x, ink and paper, for the README
 *   logo/png/mark-128.png, avatar-460.png                 the mark alone, and the avatar on the ground
 *
 * The toolbar tone is a token, icon.toolbar, chosen to clear three to one on
 * both of Chrome's toolbar colours and on both of our grounds.
 */

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const repo = join(pkg, '..', '..');
const tokens = JSON.parse(readFileSync(join(pkg, 'tokens.json'), 'utf8'));

const MARK = 'b-die';
const mark = readFileSync(join(here, 'svg', `${MARK}.svg`), 'utf8');
const markAvatar = readFileSync(join(here, 'svg', `${MARK}-avatar.svg`), 'utf8');

const ink = tokens.colour.light.ink;
const paper = tokens.colour.dark.ink;
const ground = tokens.colour.light.bg;
const toolbar = tokens.icon.toolbar;

const FONT = "'Big Shoulders', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif";
const STROKES = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

/** The mark with no role or label, filling whatever box it is placed in. */
const bare = (svg) =>
  svg
    .replace(/ role="img" aria-label="[^"]*"/, '')
    .replace(/ width="\d+" height="\d+"/, ' style="display:block;width:100%;height:100%"');

/** The mark's paths alone, for placing inside another drawing. */
const body = mark.split('\n').slice(1, -2).join('\n');

/**
 * The favicon follows the browser's colour scheme. A favicon cannot read the
 * page's theme, and does not need to: the tab strip it sits in follows the
 * system, and so does this.
 */
const favicon = mark
  .replace(/ role="img" aria-label="[^"]*"/, '')
  .replace('<svg ', `<svg style="color:${ink}" `)
  .replace('>\n', `>\n  <style>@media (prefers-color-scheme: dark) { svg { color: ${paper}; } }</style>\n`);

/**
 * The lockups, sized to the wordmark. The width of the wordmark in Big
 * Shoulders is measured in the browser rather than guessed; the first draft
 * guessed and clipped the last two words.
 */
const lockups = (textWidth) => {
  const width = Math.ceil(44 + textWidth + 2);
  const horizontal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 32" width="${width}" height="32" role="img" aria-label="Better Use of AI">
  <g transform="scale(2)" ${STROKES}>
${body}
  </g>
  <text x="44" y="26" font-family="${FONT}" font-weight="800" font-size="27" letter-spacing="0.5" fill="currentColor">BETTER USE OF AI</text>
</svg>
`;
  const stackedWidth = Math.ceil(Math.max(textWidth + 8, 120));
  const centre = stackedWidth / 2;
  const stacked = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stackedWidth} 104" width="${stackedWidth}" height="104" role="img" aria-label="Better Use of AI">
  <g transform="translate(${centre - 24} 0) scale(3)" ${STROKES}>
${body}
  </g>
  <text x="${centre}" y="94" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="27" letter-spacing="0.5" fill="currentColor">BETTER USE OF AI</text>
</svg>
`;
  return { horizontal, stacked };
};

// ------------------------------------------------------------- a server

const TYPES = { '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  const path = join(pkg, normalize(decodeURIComponent((request.url ?? '/').split('?')[0])).replace(/^[/\\]+/, ''));
  if (!path.startsWith(pkg) || !existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

const head = `<link rel="stylesheet" href="http://127.0.0.1:${port}/fonts.css">`;
const browser = await chromium.launch();
const written = [];

/** Renders one fragment to a PNG at the given device scale, transparent unless given a background. */
const shoot = async (fragment, out, { scale = 1, background = null } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: scale });
  await page.setContent(
    `<!doctype html><html><head>${head}</head><body style="margin:0;background:transparent"><div id="t" style="display:inline-block;line-height:0;background:${background ?? 'transparent'}">${fragment}</div></body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(out), { recursive: true });
  await page.locator('#t').screenshot({ path: out, omitBackground: background === null });
  await page.close();
  written.push(out.replace(repo, '').replace(/\\/g, '/'));
};

const sized = (svg, px, colour) =>
  `<span style="display:inline-block;width:${px}px;height:${px}px;color:${colour}">${bare(svg)}</span>`;

// The wordmark's width in the real face, then the lockups written to fit.
const probe = await browser.newPage();
await probe.setContent(
  `<!doctype html><html><head>${head}</head><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="800" height="60"><text id="w" x="0" y="40" font-family="${FONT}" font-weight="800" font-size="27" letter-spacing="0.5">BETTER USE OF AI</text></svg></body></html>`,
  { waitUntil: 'load' },
);
await probe.evaluate(() => document.fonts.ready);
const textWidth = await probe.evaluate(() => document.getElementById('w').getBBox().width);
await probe.close();
const { horizontal, stacked } = lockups(textWidth);
writeFileSync(join(here, 'svg', 'lockup-horizontal.svg'), horizontal, 'utf8');
writeFileSync(join(here, 'svg', 'lockup-stacked.svg'), stacked, 'utf8');
mkdirSync(join(repo, 'apps', 'site', 'public'), { recursive: true });
writeFileSync(join(repo, 'apps', 'site', 'public', 'favicon.svg'), favicon, 'utf8');
console.log(`  wordmark measures ${textWidth.toFixed(1)} px at 27 px`);

// ------------------------------------------------------------- renders

const iconDir = join(repo, 'apps', 'extension', 'public', 'icon');
for (const px of [16, 32, 48, 128]) {
  await shoot(sized(mark, px, toolbar), join(iconDir, `${px}.png`));
  await shoot(sized(mark, px, ink), join(iconDir, `${px}-ink.png`));
  await shoot(sized(mark, px, paper), join(iconDir, `${px}-paper.png`));
}

await shoot(sized(mark, 32, toolbar), join(repo, 'apps', 'site', 'public', 'favicon-32.png'));
await shoot(sized(markAvatar, 180, ink), join(repo, 'apps', 'site', 'public', 'apple-touch-icon.png'), { background: ground });
await shoot(sized(mark, 128, ink), join(here, 'png', 'mark-128.png'));
await shoot(sized(markAvatar, 460, ink), join(here, 'png', 'avatar-460.png'), { background: ground });

for (const [name, svg] of [['lockup-horizontal', horizontal], ['lockup-stacked', stacked]]) {
  for (const [tone, colour] of [['ink', ink], ['paper', paper]]) {
    await shoot(`<span style="display:inline-block;color:${colour}">${svg.replace(/ role="img" aria-label="[^"]*"/, '')}</span>`, join(here, 'png', `${name}-${tone}.png`), { scale: 2 });
  }
}

await browser.close();
server.close();
for (const one of written) console.log(`  wrote ${one}`);
