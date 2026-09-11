import type { Calibration, Range } from '@betteruseofai/core';

import { classify } from './classify.js';
import type { Classification, ContentClass } from './classify.js';

export { classify } from './classify.js';
export type { Classification, ContentClass } from './classify.js';

/**
 * Local token counting.
 *
 * Exact for OpenAI, because o200k is public and we can run it. For everyone
 * else it is o200k multiplied by a calibrated ratio, which is an estimate and
 * is always labelled as one: every count carries `exact: false` and the
 * interface renders it with a tilde.
 *
 * The encoder is a lazy chunk. It is about two megabytes of ranks and most
 * pages never need it, so it is fetched on first use and kept afterwards.
 * Nothing here reaches a network: the ranks ship inside the package.
 */

export type Provider = 'openai' | 'anthropic' | 'google' | (string & {});

export interface TokenEstimate {
  /** Best guess at the token count. */
  count: number;
  /** The range, once the calibration uncertainty is carried through. */
  range: Range;
  /** True only when we ran the provider's own encoding. */
  exact: boolean;
  /** Which estimator produced this, for the tooltip. */
  estimator: string;
  contentClass: ContentClass;
}

let encoderPromise: Promise<{ encode(text: string): number[] }> | null = null;

/** The shape js-tiktoken wants: the rank table for an encoding. */
export type Ranks = Parameters<
  typeof import('js-tiktoken/lite').Tiktoken extends new (ranks: infer R) => unknown
    ? (ranks: R) => void
    : never
>[0];

type RanksLoader = () => Promise<unknown>;

/**
 * Where the rank table comes from. Two megabytes of it, so it matters.
 *
 * The default is a dynamic import, which a bundler splits into its own chunk
 * and a caller who only needs the quick estimate never pays for.
 *
 * A browser extension needs a different answer. An extension service worker is
 * built as one file, so the dynamic import gets inlined and the worker grows to
 * two and a half megabytes that it reloads every time it wakes. Such a caller
 * passes a loader that reads the table out of a file packaged with the
 * extension. That is a local file read, not a network request: the address is
 * the extension's own, and nothing leaves the machine.
 */
let loadRanks: RanksLoader = async () => (await import('js-tiktoken/ranks/o200k_base')).default;

export const setRanksLoader = (loader: RanksLoader): void => {
  loadRanks = loader;
  // A loader set after the encoder is built would be ignored, which would be
  // a confusing way to fail. Drop the cached one so the new source is used.
  encoderPromise = null;
};

/** Loads the o200k encoder once, and keeps it. */
export const loadEncoder = async (): Promise<{ encode(text: string): number[] }> => {
  if (encoderPromise === null) {
    encoderPromise = (async () => {
      const [{ Tiktoken }, ranks] = await Promise.all([import('js-tiktoken/lite'), loadRanks()]);
      return new Tiktoken(ranks as never);
    })();
  }
  return encoderPromise;
};

/** True once the encoder is in memory, so a caller can decide whether to wait. */
export const encoderIsReady = (): boolean => encoderPromise !== null;

const factorFor = (
  calibration: Calibration,
  provider: Provider,
  contentClass: ContentClass,
): { factor: Range; exact: boolean } => {
  const entry = calibration.tokenizer.providers[provider];
  if (!entry) {
    // A provider we have never calibrated. One is the honest central guess,
    // and the range says how little we know.
    return { factor: { low: 0.8, central: 1, high: 1.4 }, exact: false };
  }
  const factor = entry.contentClasses[contentClass] ??
    entry.contentClasses['prose'] ?? { low: 1, central: 1, high: 1 };
  return { factor, exact: entry.exact };
};

const apply = (base: number, factor: Range, exact: boolean): Range =>
  exact
    ? { low: base, central: base, high: base }
    : {
        low: Math.round(base * factor.low),
        central: Math.round(base * factor.central),
        high: Math.round(base * factor.high),
      };

/**
 * Counts tokens, running the real encoder.
 *
 * Use this wherever waiting a moment is acceptable. On the first call it loads
 * the encoder, which takes a few hundred milliseconds; after that it is fast.
 */
export const estimateTokens = async (
  text: string,
  provider: Provider,
  calibration: Calibration,
): Promise<TokenEstimate> => {
  if (text === '') {
    return {
      count: 0,
      range: { low: 0, central: 0, high: 0 },
      exact: true,
      estimator: 'empty',
      contentClass: 'prose',
    };
  }

  const { contentClass } = classify(text);
  const encoder = await loadEncoder();
  const base = encoder.encode(text).length;
  const { factor, exact } = factorFor(calibration, provider, contentClass);

  return {
    count: exact ? base : Math.round(base * factor.central),
    range: apply(base, factor, exact),
    exact,
    estimator: exact ? 'o200k' : `o200k x ${provider} ${contentClass}`,
    contentClass,
  };
};

/**
 * Counts tokens without loading the encoder.
 *
 * Characters divided by a chars-per-token figure, which is good to about a
 * quarter either way. This exists for the composer hint, which runs while
 * somebody is still typing and cannot wait for a two megabyte chunk. Anything
 * that ends up stored uses the exact path instead.
 */
export const estimateTokensSync = (
  text: string,
  provider: Provider,
  calibration: Calibration,
): TokenEstimate => {
  if (text === '') {
    return {
      count: 0,
      range: { low: 0, central: 0, high: 0 },
      exact: true,
      estimator: 'empty',
      contentClass: 'prose',
    };
  }

  const { contentClass } = classify(text);
  /*
   * Characters per token is not one number. Measured against o200k it runs at
   * about 5.2 on English prose, 3.8 on code and 2.2 on mathematics, so the
   * table is keyed by class. A single global figure was 43 per cent out on
   * prose and did not bracket the real count at all.
   */
  const table = calibration.tokenizer.charsPerTokenFallback ?? {};
  const perToken = table[contentClass] ?? table['prose'] ?? { low: 4.2, central: 5.2, high: 6.3 };

  // The bounds cross over: more characters per token means fewer tokens.
  const base: Range = {
    low: Math.round(text.length / perToken.high),
    central: Math.round(text.length / perToken.central),
    high: Math.round(text.length / perToken.low),
  };

  const { factor } = factorFor(calibration, provider, contentClass);
  const range: Range = {
    low: Math.round(base.low * factor.low),
    central: Math.round(base.central * factor.central),
    high: Math.round(base.high * factor.high),
  };

  return {
    count: range.central,
    range,
    // Never exact, whatever the provider. This did not run an encoder.
    exact: false,
    estimator: `chars-per-token ${provider} ${contentClass}`,
    contentClass,
  };
};

/**
 * Counts a whole conversation.
 *
 * Message overhead is not counted. Every provider wraps messages in its own
 * scaffolding of a few tokens each and none of them document it, so adding a
 * guess would make the number look more precise than it is. The result is a
 * lower bound on the input, which is what the input-partial flag already says.
 */
export const estimateConversation = async (
  messages: Array<{ role: string; content: string }>,
  provider: Provider,
  calibration: Calibration,
): Promise<TokenEstimate> => {
  const parts = await Promise.all(
    messages.map((message) => estimateTokens(message.content, provider, calibration)),
  );

  const range = parts.reduce<Range>(
    (total, part) => ({
      low: total.low + part.range.low,
      central: total.central + part.range.central,
      high: total.high + part.range.high,
    }),
    { low: 0, central: 0, high: 0 },
  );

  const exact = parts.every((part) => part.exact);
  // The class of the longest message stands for the whole conversation.
  const longest = messages.reduce(
    (best, message, index) =>
      message.content.length > (messages[best]?.content.length ?? -1) ? index : best,
    0,
  );

  return {
    count: range.central,
    range,
    exact,
    estimator: parts[0]?.estimator ?? 'empty',
    contentClass: parts[longest]?.contentClass ?? 'prose',
  };
};
