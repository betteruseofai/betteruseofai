/**
 * Screenshots the composer hint in a page that looks like somebody else's.
 *
 * The surrounding page is deliberately styled nothing like ours: a different
 * font, a different ground, rounded corners. If the hint inherited anything
 * from a host page this is where it would show.
 *
 * Run with: node scripts/shoot.mjs
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(root, 'shots');
mkdirSync(shots, { recursive: true });

const source = readFileSync(join(root, 'dist', 'index.js'), 'utf8');

const PAGE = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8" />
<style>
  /* A host page that shares nothing with us: different font, different
     ground, rounded corners, its own colours. */
  body { font-family: Georgia, serif; background: #fdfaf5; color: #3b2f2f; margin: 0; padding: 32px; }
  .composer-wrap { max-width: 680px; margin: 0 auto; }
  .composer { border: 2px solid #c9b8a8; border-radius: 18px; padding: 14px 16px; min-height: 64px; background: #fff; font-size: 16px; }
  .send { margin-top: 10px; border-radius: 999px; padding: 8px 18px; background: #7a5c3e; color: #fff; border: 0; font-family: inherit; }
  h1 { font-size: 20px; font-weight: normal; }
</style></head>
<body>
  <div class="composer-wrap">
    <h1>Some other application</h1>
    <div id="composer" class="composer" contenteditable="true">Rewrite this paragraph so it reads more plainly and loses the jargon.</div>
    <button class="send" type="button">Send</button>
  </div>
</body></html>`;

const browser = await chromium.launch();
const written = [];

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 760, height: 340 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.setContent(PAGE);
  // Strip the module syntax and hang the two entry points off window, so the
  // page runs exactly the code the extension ships rather than a copy of it.
  const plain = source.replace(/^export\s+/gm, '').replace(/^export\s*\{[^}]*\};?$/gm, '');
  await page.addScriptTag({
    content: `${plain}\nwindow.showHint = showHint; window.removeHint = removeHint;`,
  });

  await page.evaluate(() => {
    const composer = document.getElementById('composer');
    // Calls the real showHint, so this is the element the extension renders.
    window.showHint(composer, {
      explanation:
        'Starts with "rewrite"; 12 words; no code. Claude Sonnet 5 would probably do.',
      ruleId: 'downgrade.rewrite-task',
      saving: 'about 0.48 Wh lighter',
    });
  });

  await page.waitForSelector('buai-hint');
  const name = `hint-${theme}.png`;
  await page.screenshot({ path: join(shots, name) });
  written.push(name);

  // And the case where we simply answer the question.
  await page.evaluate(() => {
    const composer = document.getElementById('composer');
    composer.textContent = 'what is 1234 + 5678?';
    window.removeHint(document);
    window.showHint(composer, {
      explanation:
        'The whole prompt is the sum 1234 + 5678. The answer is 6912.',
      ruleId: 'no-llm.arithmetic',
      answer: '6912',
    });
  });
  await page.waitForSelector('buai-hint');
  const answerName = `hint-answer-${theme}.png`;
  await page.screenshot({ path: join(shots, answerName) });
  written.push(answerName);

  await context.close();
}

await browser.close();
for (const name of written) console.log(`  wrote shots/${name}`);
