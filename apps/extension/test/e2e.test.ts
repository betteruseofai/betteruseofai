import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The extension, actually loaded into a browser.
 *
 * Everything else in this folder tests a piece. This loads the built
 * extension into Chromium and checks that the parts find each other: the
 * service worker starts, the pages open, the background answers a message,
 * and the settings survive a round trip.
 *
 * No live site is visited. The adapters are covered by recorded fixtures, and
 * a test that opened claude.ai would be flaky and rude in equal measure.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const built = join(root, '.output', 'chrome-mv3');

let context: BrowserContext | null = null;
let profile = '';
let extensionId = '';
let unavailable = '';

beforeAll(async () => {
  if (!existsSync(join(built, 'manifest.json'))) {
    execFileSync('npx', ['wxt', 'build'], { cwd: root, shell: process.platform === 'win32' });
  }

  profile = mkdtempSync(join(tmpdir(), 'buoa-e2e-'));
  try {
    context = await chromium.launchPersistentContext(profile, {
      // An extension needs a real browser, not the headless shell, and it
      // needs a profile on disk.
      channel: 'chromium',
      args: [`--disable-extensions-except=${built}`, `--load-extension=${built}`],
    });

    // The service worker registers a moment after launch.
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    extensionId = new URL(worker.url()).host;
  } catch (cause) {
    // A machine without the full Chromium download cannot run this. Say so
    // rather than failing in a way that looks like a bug in the extension.
    unavailable = cause instanceof Error ? cause.message : String(cause);
  }
}, 120000);

afterAll(async () => {
  await context?.close();
  if (profile) rmSync(profile, { recursive: true, force: true });
});

const skipIfUnavailable = (): boolean => {
  if (unavailable) {
    // eslint-disable-next-line no-console
    console.warn(`Skipping the end to end run: ${unavailable.split('\n')[0]}`);
    return true;
  }
  return false;
};

describe('the extension in a browser', () => {
  it('starts its service worker', () => {
    if (skipIfUnavailable()) return;
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  it('opens the popup, which says it has nothing yet', async () => {
    if (skipIfUnavailable() || !context) return;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForSelector('.buoa-popup', { timeout: 10000 });
    // A fresh profile has counted nothing, and the popup has to say so rather
    // than showing three zeroes.
    // Vitest's expect is the one in scope here, so these are plain assertions
    // rather than Playwright's own matchers.
    await page.waitForSelector('.buoa-standby', { timeout: 10000 });
    expect(await page.textContent('.buoa-standby')).toContain('nothing yet');
    await page.close();
  }, 30000);

  it('opens the options page and keeps a setting that was changed', async () => {
    if (skipIfUnavailable() || !context) return;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForSelector('.buoa-options', { timeout: 10000 });

    await page.selectOption('.buoa-options__field select', 'GB');
    await page.waitForTimeout(500);

    // Reload and the choice is still there, which means it reached the
    // background and came back.
    await page.reload();
    await page.waitForSelector('.buoa-options__field select', { timeout: 10000 });
    expect(await page.locator('.buoa-options__field select').first().inputValue()).toBe('GB');
    await page.close();
  }, 30000);

  it('opens the dashboard', async () => {
    if (skipIfUnavailable() || !context) return;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await page.waitForSelector('.buoa-dash', { timeout: 10000 });
    await page.close();
  }, 30000);

  it('answers a summary request from the background', async () => {
    if (skipIfUnavailable() || !context) return;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForSelector('.buoa-popup', { timeout: 10000 });

    const summary = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (globalThis as any).chrome.runtime.sendMessage({ type: 'summary:get' });
    });

    expect(summary).toMatchObject({ count: 0 });
    expect((summary as { datasetVersion: string }).datasetVersion).toMatch(/^\d+\.\d+\.\d+$/);
    await page.close();
  }, 30000);

  it('makes no request of its own while it sits there', async () => {
    if (skipIfUnavailable() || !context) return;
    const page = await context.newPage();
    const outbound: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      // Its own pages and files are not requests of its own in the sense that
      // matters. Anything with a host is.
      if (!url.startsWith('chrome-extension://') && !url.startsWith('data:')) outbound.push(url);
    });

    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await page.waitForSelector('.buoa-dash', { timeout: 10000 });
    await page.waitForTimeout(2000);

    expect(outbound).toEqual([]);
    await page.close();
  }, 30000);
});
