import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PLACEHOLDER, render } from '../scripts/build-dashboard.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The dashboard template has to stand alone on a disk with nothing to fetch.
 * These read the assembled file and check that claim rather than trusting it.
 */
describe('the dashboard template', () => {
  const html = render();

  it('carries its data placeholder exactly once', () => {
    expect(html.split(PLACEHOLDER).length - 1).toBe(1);
  });

  it('inlines every font rather than pointing at a file', () => {
    expect(html).not.toMatch(/url\('\.\/fonts\//);
    expect((html.match(/data:font\/woff2;base64,/g) ?? []).length).toBe(6);
  });

  it('reaches nowhere on its own', () => {
    // Two addresses are allowed: the link a person can choose to follow, and
    // the SVG namespace, which is an identifier the browser never fetches.
    const withoutAllowed = html
      .replace('https://betteruseofai.org/methodology', '')
      .replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '');
    expect(withoutAllowed).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  });

  it('uses the shared tokens and components, not a copy', () => {
    const tokens = readFileSync(join(root, 'tokens.css'), 'utf8');
    expect(html).toContain(tokens.trim());
    expect(html).toContain('.buai-readout__figure');
  });

  it('is the same bytes every time it is built', () => {
    expect(render()).toBe(html);
  });
});
