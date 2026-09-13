import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { load, render } from '../scripts/build-tokens.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..', '..');
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

describe('the stylesheet is what the json says', () => {
  it('regenerates byte for byte from tokens.json', () => {
    // The JSON is the source. A hand edit to the CSS shows up here, and the
    // fix is to edit the JSON and run the build.
    expect(css).toBe(render(load()));
  });

  it.each(Object.keys(tokens.colour.light).filter((name) => !name.startsWith('$')))(
    'light %s matches',
    (name) => {
      expect(light[name]).toBe(tokens.colour.light[name]);
    },
  );

  it.each(Object.keys(tokens.colour.dark).filter((name) => !name.startsWith('$')))(
    'dark %s matches',
    (name) => {
      expect(dark[name]).toBe(tokens.colour.dark[name]);
    },
  );

  it('the dark override under prefers-color-scheme repeats the same values', () => {
    const media = readBlock(":root:not([data-theme='light'])");
    for (const [name, value] of Object.entries(dark)) {
      expect(media[name], `${name} drifted between the toggle and the media query`).toBe(value);
    }
  });
});

/**
 * The ratios below are the ones recorded in the plan, with one change made in
 * the design audit of 2026-09-12: muted moved from #5b665f to #5a655e so that
 * it clears 4.5 on the accent tint, where it meets selected table rows. They
 * are asserted rather than written in a comment, so a colour cannot drift
 * without the build saying so.
 */
describe('contrast against the ground', () => {
  const cases: Array<[string, string, number]> = [
    ['ink on bg', 'ink', 14.2],
    ['ink-2 on bg', 'ink-2', 12.7],
    ['muted on bg', 'muted', 5.15],
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
   * And the ones that would fail. Muted comes out at 3.76 over a filled cell
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
      // Borders sit on panels as well as on the ground.
      expect(contrast(light[token] as string, light['bg-sunken'] as string)).toBeGreaterThanOrEqual(3);
    }
  });

  it('text still reads on a raised or sunken panel, not only on the ground', () => {
    for (const surface of ['bg-raised', 'bg-sunken']) {
      for (const token of ['ink', 'ink-2', 'muted', 'accent', 'hazard', 'danger']) {
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

  /*
   * The tint is the fill of a selected row and of the lower band of a range
   * bar, so labels in muted and figures in ink both land on it. The audit
   * found muted at 4.49 here, which is why it moved.
   */
  it('the tint is a fill, and every text colour that meets it still reads', () => {
    for (const theme of [light, dark]) {
      for (const token of ['ink', 'ink-2', 'muted', 'accent', 'hazard', 'danger']) {
        expect(
          contrast(theme[token] as string, theme['accent-tint'] as string),
          `${token} on accent-tint`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
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

  /*
   * No colour gradients. What the rule allows is written in tokens.json under
   * "gradients", by file and by count, with the reason beside each: hatching,
   * the ruled paper grid, and the scrim and mask that keep the landing headline
   * legible over its backdrop. Anything else is a wash, and a wash is the first
   * thing a generated page reaches for.
   */
  it('has exactly the gradients the tokens allow, and no others', () => {
    for (const allowed of tokens.gradients.allowed as Array<{ file: string; count: number }>) {
      const path = allowed.file.startsWith('apps/') ? join(repo, allowed.file) : join(root, allowed.file);
      const source = readFileSync(path, 'utf8');
      const found = source.match(/(repeating-)?(linear|radial|conic)-gradient\(/g) ?? [];
      expect(found.length, `${allowed.file} has ${found.length} gradients`).toBe(allowed.count);
    }
  });

  it('the hatching is hatching: every gradient in components.css repeats', () => {
    const gradients = componentsCss.match(/(linear|radial|conic)-gradient/g) ?? [];
    const hatching = componentsCss.match(/repeating-linear-gradient/g) ?? [];
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
    for (const selector of ['.buai-readout__figure', '.buai-readout__bounds', 'td.buai-num']) {
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

describe('the icon tone', () => {
  it('clears three to one on both Chrome toolbars and both grounds', () => {
    const tone = tokens.icon.toolbar as string;
    for (const behind of [
      tokens.icon.chromeToolbars.light,
      tokens.icon.chromeToolbars.dark,
      light['bg'],
      dark['bg'],
    ] as string[]) {
      expect(contrast(tone, behind), `icon tone on ${behind}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the terminal block', () => {
  it('keeps figures and caveats on colours a red-green reader can tell apart', () => {
    const { codes, roles } = tokens.terminal;
    expect(codes[roles.figure]).toBe(32);
    expect(codes[roles.caveat]).toBe(33);
    // 31 is red. It is not in the table, and it must not be.
    expect(Object.values(codes)).not.toContain(31);
  });
});
