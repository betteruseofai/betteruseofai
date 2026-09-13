import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { serve } from '../scripts/serve.mjs';

/**
 * The site, in a real browser, against the built output.
 *
 * Three things are checked here that nothing else can check: that the pages
 * are reachable by keyboard and readable by a screen reader, that the
 * calculator works and keeps its state out of the query string, and that the
 * content security policy we ship does not break the pages it protects.
 *
 * The server applies public/_headers, so the policy under test is the real
 * one rather than an aspiration in a file nobody reads until deploy day.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

let browser: Browser | null = null;
let server: { url: string; close: () => Promise<void> } | null = null;
let base = '';
let unavailable = '';

const PAGES = [
  '/',
  '/methodology',
  '/calculator',
  '/install',
  '/about',
  '/local-llms',
  '/privacy',
  '/changelog',
  '/blog',
  '/design',
];

beforeAll(async () => {
  if (!existsSync(join(dist, 'index.html'))) {
    unavailable = 'No dist folder. Run the build first.';
    return;
  }
  try {
    server = await serve(dist);
    base = server!.url;
    browser = await chromium.launch();
  } catch (cause) {
    unavailable = cause instanceof Error ? cause.message : String(cause);
  }
}, 120000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const skip = (): boolean => {
  if (unavailable) {
    // eslint-disable-next-line no-console
    console.warn(`Skipping the browser run: ${unavailable.split('\n')[0]}`);
    return true;
  }
  return false;
};

/** Opens a page and fails the test if the console reported an error. */
const open = async (path: string): Promise<{ page: Page; errors: string[] }> => {
  const page = await browser!.newPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  return { page, errors };
};

describe('every page', () => {
  it('loads with no error in the console', async () => {
    if (skip()) return;
    const broken: string[] = [];
    for (const path of PAGES) {
      const { page, errors } = await open(path);
      if (errors.length > 0) broken.push(`${path}: ${errors.join(' | ')}`);
      await page.close();
    }
    expect(broken).toEqual([]);
  }, 120000);

  it('has one h1, a skip link and a language', async () => {
    if (skip()) return;
    const wrong: string[] = [];
    for (const path of PAGES) {
      const { page } = await open(path);
      const h1s = await page.locator('h1').count();
      const lang = await page.getAttribute('html', 'lang');
      const skipTo = await page.locator('a.skip').count();
      const main = await page.locator('main#main').count();
      if (h1s !== 1) wrong.push(`${path}: ${h1s} h1 elements`);
      if (lang !== 'en-GB') wrong.push(`${path}: lang is ${lang}`);
      if (skipTo !== 1) wrong.push(`${path}: no skip link`);
      if (main !== 1) wrong.push(`${path}: no main landmark`);
      await page.close();
    }
    expect(wrong).toEqual([]);
  }, 120000);

  it('gives every control an accessible name', async () => {
    if (skip()) return;
    const unnamed: string[] = [];
    for (const path of PAGES) {
      const { page } = await open(path);
      const found = await page.evaluate(() => {
        const problems: string[] = [];
        const named = (el: Element): boolean =>
          Boolean(
            el.getAttribute('aria-label') ||
              el.getAttribute('title') ||
              (el.getAttribute('aria-labelledby') &&
                document.getElementById(el.getAttribute('aria-labelledby') as string)) ||
              (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
              el.closest('label') ||
              (el.textContent ?? '').trim(),
          );
        for (const el of document.querySelectorAll('button, a[href], select, input, textarea')) {
          if (!named(el)) problems.push(`${el.tagName.toLowerCase()} ${el.className}`);
        }
        // An image without alt text is never acceptable, empty alt included:
        // an empty one is a claim that the image is decorative.
        for (const img of document.querySelectorAll('img')) {
          if (img.getAttribute('alt') === null) problems.push(`img ${img.getAttribute('src')}`);
        }
        return problems;
      });
      for (const one of found) unnamed.push(`${path}: ${one}`);
      await page.close();
    }
    expect(unnamed).toEqual([]);
  }, 120000);

  it('keeps the tab order reaching the navigation', async () => {
    if (skip()) return;
    const { page } = await open('/');
    await page.keyboard.press('Tab');
    // The skip link is first, which is the whole point of a skip link.
    const first = await page.evaluate(() => document.activeElement?.className ?? '');
    expect(first).toContain('skip');
    await page.close();
  }, 60000);

  it('works with JavaScript switched off', async () => {
    if (skip()) return;
    const context = await browser!.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const missing: string[] = [];
    for (const path of PAGES) {
      await page.goto(`${base}${path}`);
      // Everything except the calculator's interactivity has to work. The
      // nav, the copy, the tables and the FAQ are all markup.
      const nav = await page.locator('nav.buai-nav a').count();
      const headline = (await page.textContent('h1')) ?? '';
      if (nav < 5) missing.push(`${path}: navigation did not render`);
      if (headline.trim().length === 0) missing.push(`${path}: no headline`);
    }
    // The landing readouts are rendered on the server, so they are there too.
    await page.goto(`${base}/`);
    const figure = (await page.textContent('.buai-readout__figure')) ?? '';
    if (!/\d/.test(figure)) missing.push('landing: no figure without script');
    expect(missing).toEqual([]);
    await context.close();
  }, 120000);
});

describe('the content security policy', () => {
  it('is served, and starts from nothing', async () => {
    if (skip()) return;
    const response = await fetch(`${base}/`);
    const policy = response.headers.get('content-security-policy') ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'none'");
    // Scripts come from here, or from the one analytics host the privacy page
    // names. Nothing else, and no unsafe-inline.
    expect(policy).toMatch(/script-src 'self' https:\/\/static\.cloudflareinsights\.com/);
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('does not block anything the pages need', async () => {
    if (skip()) return;
    const violations: string[] = [];
    for (const path of PAGES) {
      const page = await browser!.newPage();
      page.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) {
          violations.push(`${path}: ${message.text()}`);
        }
      });
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await page.close();
    }
    expect(violations).toEqual([]);
  }, 120000);

  it('covers every inline script it ships with a hash', () => {
    if (skip()) return;
    // Astro's islands bootstrap with an inline script, so "no inline script"
    // is not a rule this architecture can keep. The rule it can keep is that
    // every one of them is hashed into the policy on its own page. This checks
    // that directly, by hashing what shipped and looking for it.
    const uncovered: string[] = [];
    let examined = 0;

    for (const file of readdirSync(dist).filter((name) => name.endsWith('.html'))) {
      const html = readFileSync(join(dist, file), 'utf8');
      const policy = html.match(/http-equiv="content-security-policy" content="([^"]*)"/i)?.[1] ?? '';

      for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        const attrs = match[1] ?? '';
        const body = match[2] ?? '';
        if (/\ssrc=/.test(attrs)) continue;
        // A JSON payload is data. The browser never executes it.
        if (/type="application\/(ld\+)?json"/.test(attrs)) continue;
        if (body.trim() === '') continue;

        examined += 1;
        const hash = createHash('sha256').update(body, 'utf8').digest('base64');
        if (!policy.includes(hash)) uncovered.push(`${file}: ${body.trim().slice(0, 60)}`);
      }
    }

    expect(uncovered).toEqual([]);
    // A check that examined nothing is a check that cannot fail. The islands
    // bootstrap inline, so there is always at least one.
    expect(examined).toBeGreaterThan(0);
  });
});

describe('the calculator', () => {
  it('answers, and puts its state in the hash rather than the query', async () => {
    if (skip()) return;
    const { page } = await open('/calculator');
    await page.waitForSelector('.calc__out .buai-readout__figure');

    const before = (await page.textContent('.calc__out .buai-readout__figure')) ?? '';
    expect(before.trim().length).toBeGreaterThan(0);

    await page.locator('.calc__dials input[type="number"]').first().fill('200');
    // The hash is written in an effect, one tick after the render that changed
    // the figure, so waiting on the figure is not enough. Wait on the hash.
    await page.waitForFunction(() => window.location.hash.includes('prompts=200'), undefined, {
      timeout: 10000,
    });
    expect((await page.textContent('.calc__out .buai-readout__figure')) ?? '').not.toBe(before);

    const url = new URL(page.url());
    expect(url.search).toBe('');
    expect(url.hash).toContain('prompts=200');
    await page.close();
  }, 60000);

  it('comes back to the same numbers from a pasted address', async () => {
    if (skip()) return;
    const hash = '#model=claude-haiku-4.5&region=FR&prompts=7&in=400&out=300&period=day&scope=on-site';
    const { page } = await open(`/calculator${hash}`);
    await page.waitForSelector('.calc__out .buai-readout__figure');

    expect(await page.locator('.calc__dials select').first().inputValue()).toBe('claude-haiku-4.5');
    expect(await page.locator('.calc__dials input[type="number"]').first().inputValue()).toBe('7');
    await page.close();
  }, 60000);

  it('never renders a missing figure as zero', async () => {
    if (skip()) return;
    const { page } = await open('/calculator');
    await page.waitForSelector('.calc__out .buai-readout__figure');

    const figures = await page.locator('.calc__out .buai-readout__figure').allTextContents();
    for (const figure of figures) {
      const text = figure.trim();
      expect(text === '0' || text === '0.00').toBe(false);
    }
    await page.close();
  }, 60000);

  it('makes no request to any host', async () => {
    if (skip()) return;
    const page = await browser!.newPage();
    const outbound: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(base) && !request.url().startsWith('data:')) {
        outbound.push(request.url());
      }
    });
    await page.goto(`${base}/calculator`, { waitUntil: 'networkidle' });
    await page.locator('.calc__dials input[type="number"]').first().fill('55');
    await page.waitForTimeout(1500);
    expect(outbound).toEqual([]);
    await page.close();
  }, 60000);
});

describe('the budgets', () => {
  const sizeOf = (path: string): number => (existsSync(path) ? statSync(path).size : 0);

  it('keeps the landing page script under 25 kB compressed', () => {
    if (skip()) return;
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const srcs = [...html.matchAll(/src="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1] as string);
    const total = srcs.reduce(
      (sum, src) => sum + gzipSync(readFileSync(join(dist, src))).length,
      0,
    );
    expect(total).toBeLessThan(25 * 1024);
  });

  it('keeps the fonts under 130 kB', () => {
    if (skip()) return;
    const astro = join(dist, '_astro');
    const fonts = readdirSync(astro).filter((name) => name.endsWith('.woff2'));
    const total = fonts.reduce((sum, name) => sum + sizeOf(join(astro, name)), 0);
    // Greater than zero as well, so a build that shipped no fonts at all
    // cannot pass this by being small.
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(130 * 1024);
  });

  it('keeps the whole landing page under 250 kB over the wire', () => {
    if (skip()) return;
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+)"/g)].map((m) => m[1] as string);
    const unique = [...new Set(assets)];
    const total =
      gzipSync(Buffer.from(html)).length +
      unique.reduce((sum, asset) => {
        const path = join(dist, asset);
        if (!existsSync(path)) return sum;
        // Fonts and images are already compressed.
        return sum + (/\.(woff2|png|jpe?g)$/.test(asset)
          ? statSync(path).size
          : gzipSync(readFileSync(path)).length);
      }, 0);
    expect(total).toBeLessThan(250 * 1024);
  });
});

describe('the backdrop', () => {
  it('prints its own weight in the footer', async () => {
    if (skip()) return;
    const { page } = await open('/');
    // The footer says what the page weighs, filled in after the build.
    const strip = (await page.textContent('.buai-metastrip')) ?? '';
    expect(strip).toMatch(/\d+ kB over the wire/);
    await page.close();
  }, 60000);

  it('holds still when asked, and remembers', async () => {
    if (skip()) return;
    const { page } = await open('/');
    await page.click('[data-still-toggle]');
    expect(await page.getAttribute('html', 'data-still')).toBe('1');
    expect(await page.getAttribute('[data-dither]', 'data-ended')).toBe('1');
    expect((await page.textContent('[data-still-toggle]'))?.trim()).toBe('Motion');
    await page.reload({ waitUntil: 'networkidle' });
    expect(await page.getAttribute('html', 'data-still')).toBe('1');
    // With the toggle on, the caret stands and the stage does not swell.
    const swell = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-dither]') as Element).getPropertyValue('--swell').trim(),
    );
    expect(Number.parseFloat(swell)).toBe(0);
    await page.close();
  }, 60000);

  it('holds the composed ending under reduced motion', async () => {
    if (skip()) return;
    const context = await browser!.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    expect(await page.getAttribute('[data-dither]', 'data-ended')).toBe('1');
    const caption = (await page.textContent('[data-dither-caption]')) ?? '';
    expect(caption).toContain('V ·');
    await context.close();
  }, 60000);
});

describe('the performance budgets that need a browser', () => {
  /*
   * Soft by default: the numbers are printed on every run and only fail the
   * build when BUAI_PERF_STRICT is set, because a shared CI machine can turn
   * a frame budget into a coin toss. On this machine, over the loopback
   * address, the landing page paints its largest element well under a second.
   */
  it('reports the largest contentful paint and the frame rate of the backdrop', async () => {
    if (skip()) return;
    const page = await browser!.newPage();
    await page.goto(`${base}/`, { waitUntil: 'load' });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let latest = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) latest = entry.startTime;
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(latest);
          }, 1500);
        }),
    );
    const frames = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const gaps: number[] = [];
          let last = performance.now();
          const tick = (now: number) => {
            gaps.push(now - last);
            last = now;
            if (gaps.length < 90) requestAnimationFrame(tick);
            else resolve(gaps);
          };
          requestAnimationFrame(tick);
        }),
    );
    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    // eslint-disable-next-line no-console
    console.log(`  landing: LCP ${Math.round(lcp)} ms, 95th percentile frame gap ${p95.toFixed(1)} ms`);
    if (process.env['BUAI_PERF_STRICT'] === '1') {
      expect(lcp).toBeLessThan(2000);
      expect(p95).toBeLessThan(34);
    }
    await page.close();
  }, 60000);
});
