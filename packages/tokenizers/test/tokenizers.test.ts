import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { classify } from '../src/classify.js';
import { estimateConversation, estimateTokens, estimateTokensSync, loadEncoder } from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataset = JSON.parse(
  readFileSync(join(root, 'packages', 'dataset', 'dist', 'dataset.json'), 'utf8'),
);
const calibration = dataset.calibration;

const PROSE = 'The published measurements of AI energy use disagree by an order of magnitude.';
const CODE = '```js\nfunction total(items) {\n  return items.reduce((a, b) => a + b.price, 0);\n}\n```';
const MATHS = 'Given \\(x^2 + y^2 = r^2\\), derive \\frac{dy}{dx} where 3 + 4 = 7 and \\sum_{i=1}^n i.';
const JAPANESE = 'これは日本語のテキストです。トークン数を数えます。';

describe('classifying a passage', () => {
  it('calls plain english prose', () => {
    expect(classify(PROSE).contentClass).toBe('prose');
  });

  it('calls a code fence code', () => {
    expect(classify(CODE).contentClass).toBe('code');
  });

  it('calls a formula maths', () => {
    expect(classify(MATHS).contentClass).toBe('maths');
  });

  it('calls a passage outside the latin range non-latin', () => {
    expect(classify(JAPANESE).contentClass).toBe('non-latin');
    expect(classify(JAPANESE).nonLatinShare).toBeGreaterThan(0.5);
  });

  it('treats an empty string as prose rather than throwing', () => {
    expect(classify('').contentClass).toBe('prose');
  });

  it('does not go quadratic on a long passage', () => {
    // The real budget is about two milliseconds. The ceiling here is fifty,
    // because a loaded machine is not a laptop and a flaky test is worse than
    // a loose one. What this catches is an accidental quadratic, not a
    // regression of a few microseconds.
    const long = `${PROSE} `.repeat(500);
    const started = performance.now();
    for (let run = 0; run < 50; run += 1) classify(long);
    expect((performance.now() - started) / 50).toBeLessThan(50);
  });
});

describe('counting for OpenAI, which we can do exactly', () => {
  it('runs the real encoder and says the count is exact', async () => {
    const result = await estimateTokens(PROSE, 'openai', calibration);
    expect(result.exact).toBe(true);
    expect(result.range.low).toBe(result.range.central);
    expect(result.range.high).toBe(result.range.central);
    expect(result.count).toBeGreaterThan(10);
    expect(result.count).toBeLessThan(30);
  });

  it('agrees with the encoder run directly', async () => {
    const encoder = await loadEncoder();
    const result = await estimateTokens(CODE, 'openai', calibration);
    expect(result.count).toBe(encoder.encode(CODE).length);
  });
});

describe('counting for everyone else, which we cannot', () => {
  it('never claims to be exact', async () => {
    for (const provider of ['anthropic', 'google', 'somebody-new']) {
      const result = await estimateTokens(PROSE, provider, calibration);
      expect(result.exact, provider).toBe(false);
      expect(result.range.low, provider).toBeLessThan(result.range.high);
    }
  });

  it('applies the class factor, so code costs more than prose for Anthropic', async () => {
    const encoder = await loadEncoder();
    const sample = `${CODE}\n${CODE}`;
    const base = encoder.encode(sample).length;
    const result = await estimateTokens(sample, 'anthropic', calibration);
    // The code factor is 1.30 against 1.16 for prose, so the count is well above the base.
    expect(result.contentClass).toBe('code');
    expect(result.count).toBeGreaterThan(base * 1.2);
    expect(result.count).toBeLessThan(base * 1.4);
  });

  it('names the provider and the class in the estimator, so the tooltip can say why', async () => {
    const result = await estimateTokens(PROSE, 'anthropic', calibration);
    expect(result.estimator).toContain('anthropic');
    expect(result.estimator).toContain('prose');
  });

  it('gives a wide range for a provider nobody has calibrated', async () => {
    const known = await estimateTokens(PROSE, 'anthropic', calibration);
    const unknown = await estimateTokens(PROSE, 'somebody-new', calibration);
    const width = (one: { range: { low: number; high: number } }) => one.range.high - one.range.low;
    expect(width(unknown)).toBeGreaterThan(width(known));
  });
});

describe('the synchronous estimate, for text somebody is still typing', () => {
  it('never claims to be exact, not even for OpenAI', () => {
    const result = estimateTokensSync(PROSE, 'openai', calibration);
    expect(result.exact).toBe(false);
    expect(result.estimator).toContain('chars-per-token');
  });

  it('lands within a quarter of the real count on prose', async () => {
    const real = await estimateTokens(PROSE, 'openai', calibration);
    const quick = estimateTokensSync(PROSE, 'openai', calibration);
    const error = Math.abs(quick.count - real.count) / real.count;
    expect(error).toBeLessThan(0.25);
  });

  it('brackets the real count inside its range', async () => {
    for (const sample of [PROSE, CODE, MATHS]) {
      const real = await estimateTokens(sample, 'openai', calibration);
      const quick = estimateTokensSync(sample, 'openai', calibration);
      expect(quick.range.low, sample.slice(0, 20)).toBeLessThanOrEqual(real.count);
      expect(quick.range.high, sample.slice(0, 20)).toBeGreaterThanOrEqual(real.count);
    }
  });

  it('is much cheaper than running the encoder, which is the whole point', async () => {
    // Relative rather than absolute. The claim worth testing is that the quick
    // path avoids the encoder, and comparing the two says that whatever else
    // the machine is doing at the time.
    await loadEncoder();

    const quickStart = performance.now();
    for (let run = 0; run < 200; run += 1) estimateTokensSync(PROSE, 'anthropic', calibration);
    const quick = performance.now() - quickStart;

    const exactStart = performance.now();
    for (let run = 0; run < 200; run += 1) await estimateTokens(PROSE, 'anthropic', calibration);
    const exact = performance.now() - exactStart;

    expect(quick).toBeLessThan(exact);
  });
});

describe('a whole conversation', () => {
  const messages = [
    { role: 'user', content: PROSE },
    { role: 'assistant', content: CODE },
    { role: 'user', content: MATHS },
  ];

  it('adds the parts up bound by bound', async () => {
    const total = await estimateConversation(messages, 'anthropic', calibration);
    const parts = await Promise.all(
      messages.map((one) => estimateTokens(one.content, 'anthropic', calibration)),
    );
    const sum = parts.reduce((acc, part) => acc + part.range.central, 0);
    expect(total.range.central).toBe(sum);
  });

  it('is exact only when every part was', async () => {
    expect((await estimateConversation(messages, 'openai', calibration)).exact).toBe(true);
    expect((await estimateConversation(messages, 'anthropic', calibration)).exact).toBe(false);
  });

  it('counts nothing for message scaffolding, which is a lower bound and is meant to be', async () => {
    // Providers wrap every message in a few tokens and none of them document
    // how many. Adding a guess would make the figure look more precise than it
    // is; the input-partial flag already says the input is a lower bound.
    const one = await estimateTokens(PROSE, 'openai', calibration);
    const wrapped = await estimateConversation([{ role: 'user', content: PROSE }], 'openai', calibration);
    expect(wrapped.range.central).toBe(one.range.central);
  });
});

describe('empty input', () => {
  it('is zero, and that is the one place zero is right', async () => {
    expect((await estimateTokens('', 'anthropic', calibration)).count).toBe(0);
    expect(estimateTokensSync('', 'anthropic', calibration).count).toBe(0);
  });
});
