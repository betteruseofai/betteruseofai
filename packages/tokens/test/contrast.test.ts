import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'tokens.css'), 'utf8');
const componentsCss = readFileSync(join(root, 'components.css'), 'utf8');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));

/** Relative luminance, WCAG 2.x definition. */
const luminance = (hex: string): number => {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const part = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const contrast = (a: string, b: string): number => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Reads the custom properties out of one block of the stylesheet, so the test
 * checks the file the browser loads rather than a copy of the numbers.
 */
const readBlock = (selector: string): Record<string, string> => {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`tokens.css has no block for ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const values: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = /^\s*--([a-z0-9-]+):\s*([^;]+);/.exec(line);
    if (match?.[1] && match[2]) values[match[1]] = match[2].trim();
  }
  return values;
};

const light = readBlock(':root {');
const dark = readBlock(":root[data-theme='dark']");

describe('the stylesheet and the json say the same thing', () => {
  it.each(Object.keys(tokens.colour.light))('light %s matches', (name) => {
    expect(light[name]).toBe(tokens.colour.light[name]);
  });

  it.each(Object.keys(tokens.colour.dark))('dark %s matches', (name) => {
    expect(dark[name]).toBe(tokens.colour.dark[name]);
  });

  it('the dark override under prefers-color-scheme repeats the same values', () => {
    const media = readBlock(":root:not([data-theme='light'])");
    for (const [name, value] of Object.entries(dark)) {
      expect(media[name], `${name} drifted between the toggle and the media query`).toBe(value);
    }
  });
});

/**
 * The ratios below are the ones recorded in the plan. They are asserted rather
 * than written in a comment, so a colour cannot drift without the build saying so.
 */
describe('contrast against the ground', () => {
  const cases: Array<[string, string, number]> = [
    ['ink on bg', 'ink', 14.2],
    ['ink-2 on bg', 'ink-2', 12.7],
    ['muted on bg', 'muted', 5.07],
    ['accent on bg', 'accent', 5.59],
    ['accent-strong on bg', 'accent-strong', 6.88],
    ['hazard on bg', 'hazard', 5.27],
    ['danger on bg', 'danger', 6.27],
    ['border-ui on bg', 'border-ui', 4.05],
  ];

  it.each(cases)('%s is close to the recorded ratio', (_name, token, expected) => {
    const actual = contrast(light[token] as string, light['bg'] as string);
    expect(actual).toBeGreaterThan(expected - 0.15);
    expect(actual).toBeLessThan(expected + 0.15);
  });

  it('every text colour clears WCAG AA for body text', () => {
    for (const token of ['ink', 'ink-2', 'muted', 'accent', 'accent-strong', 'hazard', 'danger']) {
      expect(contrast(light[token] as string, light['bg'] as string), `light ${token}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark[token] as string, dark['bg'] as string), `dark ${token}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /*
   * The landing page draws a dither field in the hairline colour behind its
   * headline, so text sits on top of those cells rather than on the ground.
   * The worst case is a letter falling entirely on a filled cell.
   */
  it('keeps headline text readable over the dither field', () => {
    for (const token of ['ink', 'ink-2']) {
      expect(
        contrast(light[token] as string, light['hairline'] as string),
        `light ${token} over a filled cell`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(dark[token] as string, dark['hairline'] as string),
        `dark ${token} over a filled cell`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  /*
   * And the ones that would fail. Muted comes out at 3.70 over a filled cell
   * in the light theme and accent at 4.08, so neither may be placed over the
   * field. This test exists to say that out loud: if a future change makes
   * them pass, the restriction can be lifted deliberately rather than by
   * somebody assuming it was always fine.
   */
  it('records which colours may not sit over the dither field', () => {
    expect(contrast(light['muted'] as string, light['hairline'] as string)).toBeLessThan(4.5);
    expect(contrast(light['accent'] as string, light['hairline'] as string)).toBeLessThan(4.5);
  });

  it('every interface border clears the three to one rule for non-text', () => {
    for (const token of ['border-ui']) {
      expect(contrast(light[token] as string, light['bg'] as string)).toBeGreaterThanOrEqual(3);
      expect(contrast(dark[token] as string, dark['bg'] as string)).toBeGreaterThanOrEqual(3);
    }
  });

  it('text still reads on a raised or sunken panel, not only on the ground', () => {
    for (const surface of ['bg-raised', 'bg-sunken']) {
      for (const token of ['ink', 'ink-2', 'muted']) {
        expect(
          contrast(light[token] as string, light[surface] as string),
          `light ${token} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(dark[token] as string, dark[surface] as string),
          `dark ${token} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('the button reads: ground on accent', () => {
    expect(contrast(light['bg'] as string, light['accent'] as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark['bg'] as string, dark['accent'] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it('the tint is a fill, not a text colour, and ink still reads on it', () => {
    expect(contrast(light['ink'] as string, light['accent-tint'] as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark['ink'] as string, dark['accent-tint'] as string)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the rules that keep it from looking generated', () => {
  it('nothing is rounded', () => {
    expect(light['radius']).toBe('0');
    const radii = componentsCss.match(/border-radius:\s*([^;]+);/g) ?? [];
    for (const radius of radii) {
      expect(radius).toMatch(/border-radius:\s*(0|var\(--radius\))/);
    }
  });

  it('the only gradients are the hazard hatching', () => {
    const gradients = componentsCss.match(/(linear|radial|conic)-gradient/g) ?? [];
    const hatching = componentsCss.match(/repeating-linear-gradient/g) ?? [];
    // The paper grid rule is the third, and it is a rule rather than a wash.
    expect(gradients.length).toBe(hatching.length);
  });

  it('there is exactly one accent hue', () => {
    const accents = [light['accent'], light['accent-strong'], light['accent-tint']] as string[];
    const hues = accents.map((hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return 0;
      const d = max - min;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return ((h * 60) % 360 + 360) % 360;
    });
    for (const hue of hues) {
      expect(hue, `hue ${hue} is not in the green band`).toBeGreaterThan(120);
      expect(hue).toBeLessThan(175);
    }
  });

  it('every number in the interface is set in the mono face', () => {
    for (const selector of ['.buoa-readout__figure', '.buoa-readout__bounds', 'td.buoa-num']) {
      const index = componentsCss.indexOf(selector);
      expect(index, `${selector} is missing`).toBeGreaterThan(-1);
      const block = componentsCss.slice(index, componentsCss.indexOf('}', index));
      expect(block, selector).toContain('--font-mono');
      expect(block, selector).toContain('tabular-nums');
    }
  });

  it('no font stack falls back to Inter, the default of every generated page', () => {
    const stacks = [...`${css}${componentsCss}`.matchAll(/(?:font-family|--font-[a-z]+):([^;]+);/g)].map(
      (match) => match[1] ?? '',
    );
    expect(stacks.length).toBeGreaterThan(3);
    for (const stack of stacks) {
      expect(stack.toLowerCase(), stack).not.toMatch(/\binter\b/);
    }
  });

  it('motion is short and respects the reduced motion setting', () => {
    expect(Number.parseInt(light['tempo-slow'] as string, 10)).toBeLessThanOrEqual(320);
    expect(css).toContain('prefers-reduced-motion');
    expect(componentsCss).toContain('prefers-reduced-motion');
  });
});
