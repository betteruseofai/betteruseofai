import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderDashboard } from '../../src/commands/dashboard.js';
import { run } from '../../src/run.js';

/**
 * The dashboard in a browser. Kept out of the unit run, which has no browser
 * on most machines and none on the CI matrix; `pnpm test:browser` runs it, in
 * its own job, like the site's and the extension's.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const logs = join(repoRoot, 'fixtures', 'logs', 'claude-code');

beforeAll(() => {
  process.env['BUAI_STATE_DIR'] = mkdtempSync(join(tmpdir(), 'buai-cli-'));
  process.env['BUAI_LOG_DIR'] = mkdtempSync(join(tmpdir(), 'buai-log-'));
  process.env['BUAI_CONFIG'] = join(mkdtempSync(join(tmpdir(), 'buai-config-')), 'none.json');
});

describe('the dashboard in a browser', () => {
  it('opens a chart wider than the window on its newest bars, and says so', async () => {
    // The fixtures hold two days. Thirty, as a month of use gives, is wider than 1440 pixels.
    const result = await run([
      'dashboard', '--json', '--no-log', '--now', '2026-09-15T12:00:00.000Z', '--no-color',
      '--source', 'claude-code', '--dir', logs,
    ]);
    const body = JSON.parse(result.stdout);
    const day = body.byDay[0];
    body.byDay = Array.from({ length: 30 }, (_, index) => ({
      ...day,
      key: `2026-08-${String(index + 1).padStart(2, '0')}`,
    }));
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.setContent(renderDashboard(JSON.stringify(body)));
      // A string, because this package is typed for Node and has no DOM types.
      const charts = await page.evaluate(`[...document.querySelectorAll('.buai-dash__bars')].map((chart) => {
        const cue = chart.nextElementSibling;
        return {
          bars: chart.children.length,
          wider: chart.scrollWidth > chart.clientWidth + 1,
          atNewest: chart.scrollLeft + chart.clientWidth >= chart.scrollWidth - 1,
          cue: Boolean(cue && cue.classList.contains('buai-dash__cue') && !cue.hidden),
        };
      })`);
      // The week chart has one bar and fits; the day chart has thirty and doesn't.
      expect(charts).toEqual([
        { bars: 1, wider: false, atNewest: true, cue: false },
        { bars: 30, wider: true, atNewest: true, cue: true },
      ]);
    } finally {
      await browser.close();
    }
  }, 60000);
});
