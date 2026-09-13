#!/usr/bin/env node
/**
 * One screenshot per beat of the dither sequence, at an exact time.
 *
 * Sleeping for the right number of milliseconds does not work: each
 * screenshot takes a few hundred of them, the error accumulates, and by the
 * fourth frame you are capturing a different scene than the one you asked
 * for. That produced a "rack" frame showing the river.
 *
 * So animation frames are queued rather than run, and this drives the clock.
 * Every frame is captured at precisely the time it claims to be.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { serve } from './serve.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const shots = join(root, 'shots', 'dither');

/** Matches the score in src/islands/dither/index.ts. */
const HOLD_NATURE = 1.5;
const DISSOLVE = 2.6;
const HOLD_BUILT = 1.7;
const PAIR = HOLD_NATURE + DISSOLVE + HOLD_BUILT + 1.0;

const PAIRS = ['I-canopy-rack', 'II-river-coolant', 'III-soil-wafer', 'IV-roots-fibre'];

const beats = [];
PAIRS.forEach((name, index) => {
  const base = index * PAIR;
  beats.push([`${name}-1-nature`, base + HOLD_NATURE * 0.6]);
  beats.push([`${name}-2-dither`, base + HOLD_NATURE + DISSOLVE * 0.5]);
  beats.push([`${name}-3-built`, base + HOLD_NATURE + DISSOLVE + HOLD_BUILT * 0.6]);
});

const server = await serve(join(root, 'dist'));
const browser = await chromium.launch();
mkdirSync(shots, { recursive: true });

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.addInitScript((value) => {
    try {
      localStorage.setItem('buai-theme', value);
    } catch {
      /* storage blocked; the frame still renders in light */
    }
  }, theme);

  // Queue animation frames instead of running them, so the clock is ours.
  await page.addInitScript(() => {
    const queue = [];
    window.requestAnimationFrame = (callback) => queue.push(callback);
    window.cancelAnimationFrame = () => {};
    window.__advance = (ms) => {
      for (let run = 0; run < 3; run += 1) {
        const due = queue.splice(0);
        for (const callback of due) callback(ms);
      }
    };
  });

  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)));

  await page.goto(`${server.url}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // The first frame sets the start time, so everything after is relative to it.
  await page.evaluate(() => window.__advance(0));

  for (const [name, at] of beats) {
    await page.evaluate((ms) => window.__advance(ms), at * 1000);
    await page.screenshot({
      path: join(shots, `${theme}-${name}.png`),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });
  }

  if (errors.length > 0) console.error(`${theme}: ${errors.join(' | ')}`);
  await context.close();
}

await browser.close();
await server.close();
console.log(`${beats.length * 2} beat frames in apps/site/shots/dither`);
