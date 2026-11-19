import { downgradeTarget, estimate, formatRange, getModel } from '@betteruseofai/core';
import type { Dataset, Estimate, EstimateOptions, Model, Range, UsageEvent } from '@betteruseofai/core';

/**
 * What the Stop hook says about a Claude Code session as a whole.
 *
 * This replaced a nudge on each prompt (audit, "The nudge in Claude Code",
 * decided 2026-11-19). In an agent a short prompt points at a lot of context,
 * so the wording of a prompt told us nothing about the work, and the per
 * prompt hint fired on 1 of 240 prompts at its bar and wrongly on a quarter at
 * the default. What does move the number is measured after the turn: how much
 * context each turn re-reads, and which model the session runs on. So each of
 * those gets one message, once a session, after the turn has finished, priced
 * from the turns themselves.
 */

/** A turn reading more than this much context is the thing worth mentioning. */
export const LONG_CONTEXT_TOKENS = 150_000;

/** Priced turns before a session counts as long. */
export const LONG_SESSION_TURNS = 30;

/** The share of those turns on a model with a smaller sibling before we say so. */
export const TOP_MODEL_SHARE = 0.8;

export const SESSION_RULES = {
  longContext: 'session.long-context',
  topModel: 'session.top-model',
} as const;

export type SessionRuleId = (typeof SESSION_RULES)[keyof typeof SESSION_RULES];

export interface SessionNudge {
  ruleId: SessionRuleId;
  message: string;
}

export interface SessionNudgeInput {
  events: UsageEvent[];
  estimates: Estimate[];
  dataset: Dataset;
  /** Region, scope and basis, the same as the person's own figures. */
  settings: Omit<EstimateOptions, 'dataset'>;
  /** Rules already said this session. Each one speaks once. */
  said: readonly string[];
  /** Rules muted with /betteruseofai:mute. */
  muted: readonly string[];
}

/** Everything the turn read before answering: fresh input and both kinds of cache. */
export const contextTokens = (event: UsageEvent): number =>
  (event.tokens.input ?? 0) + (event.tokens.cachedRead ?? 0) + (event.tokens.cachedWrite ?? 0);

const thousands = (tokens: number): string =>
  (Math.round(tokens / 1000) * 1000).toLocaleString('en-GB');

/** Bound by bound, floored at nothing, for the reason saving.ts gives (audit E4). */
const minus = (a: Range | null, b: Range | null): Range | null => {
  if (!a || !b) return null;
  const low = Math.max(0, a.low - b.low);
  const central = Math.max(0, a.central - b.central);
  const high = Math.max(0, a.high - b.high);
  return { low: Math.min(low, central), central, high: Math.max(high, central) };
};

const plus = (a: Range | null, b: Range | null): Range | null => {
  if (!a) return b;
  if (!b) return a;
  return { low: a.low + b.low, central: a.central + b.central, high: a.high + b.high };
};

const longContext = (input: SessionNudgeInput): SessionNudge | null => {
  const sizes = input.events.map(contextTokens);
  const largest = Math.max(0, ...sizes);
  if (largest <= LONG_CONTEXT_TOKENS) return null;

  // The share of the energy on the big turns, over turns we could price. A
  // turn on a model we don't know is in neither side.
  let all = 0;
  let big = 0;
  input.estimates.forEach((one, index) => {
    const central = one.energyWh?.central;
    if (central === undefined) return;
    all += central;
    if ((sizes[index] ?? 0) > LONG_CONTEXT_TOKENS) big += central;
  });
  const share =
    all > 0
      ? ` Turns over ${thousands(LONG_CONTEXT_TOKENS)} tokens hold ${Math.round((big / all) * 100)}% of this session's energy so far.`
      : '';

  return {
    ruleId: SESSION_RULES.longContext,
    message:
      `Rule ${SESSION_RULES.longContext}: a turn in this session read ${thousands(largest)} tokens of context, and every turn after it reads all of that again.${share}` +
      ' A fresh session or /compact between tasks keeps it down.' +
      " The cost of re-reading cached context is the least certain part of our estimate, so take the energy as a rough guide.",
  };
};

const topModel = (input: SessionNudgeInput): SessionNudge | null => {
  const { dataset } = input;
  const priced: Array<{ event: UsageEvent; estimate: Estimate; model: Model }> = [];
  input.events.forEach((event, index) => {
    const one = input.estimates[index];
    const model = one?.modelId ? getModel(one.modelId, dataset) : null;
    if (one && model && one.energyWh) priced.push({ event, estimate: one, model });
  });
  if (priced.length < LONG_SESSION_TURNS) return null;

  const onTop = priced
    .map((turn) => ({ ...turn, target: downgradeTarget(turn.model, dataset) }))
    .filter((turn): turn is typeof turn & { target: Model } => turn.target !== null);
  if (onTop.length / priced.length < TOP_MODEL_SHARE) return null;

  // Every turn moved one rung down its own ladder, same tokens, same settings.
  let saved: Range | null = null;
  for (const turn of onTop) {
    const swapped = estimate(
      { ...turn.event, modelId: turn.target.id, modelRaw: turn.target.id },
      { dataset, ...input.settings },
    );
    saved = plus(saved, minus(turn.estimate.energyWh, swapped.energyWh));
  }
  if (!saved || saved.central <= 0) return null;

  const counts = new Map<string, { model: Model; target: Model; turns: number }>();
  for (const turn of onTop) {
    const entry = counts.get(turn.model.id) ?? { model: turn.model, target: turn.target, turns: 0 };
    entry.turns += 1;
    counts.set(turn.model.id, entry);
  }
  const ranked = [...counts.values()].sort((a, b) => b.turns - a.turns || (a.model.id < b.model.id ? -1 : 1));
  const main = ranked[0] as { model: Model; target: Model };
  const single = ranked.length === 1;

  const howMany =
    onTop.length === priced.length
      ? `All ${priced.length} of this session's turns`
      : `${onTop.length} of this session's ${priced.length} turns`;
  const ran = single
    ? `${howMany} ran on ${main.model.displayName}.`
    : `${howMany} ran on a model with a smaller sibling, mostly ${main.model.displayName}.`;
  const swap = single ? `on ${main.target.displayName}` : 'one rung down';

  return {
    ruleId: SESSION_RULES.topModel,
    message:
      `Rule ${SESSION_RULES.topModel}: ${ran} The same turns ${swap} would have used about ${formatRange(saved, { unit: 'Wh' })} less energy.` +
      ' Switching part way through starts the cache again, which that leaves out.' +
      ' If the rest of the work is lighter, /model moves the session down.',
  };
};

/**
 * At most one message a turn. When both are due on the same turn the context
 * goes first, and the other waits for the next one.
 */
export const sessionNudge = (input: SessionNudgeInput): SessionNudge | null => {
  const quiet = new Set([...input.said, ...input.muted]);
  for (const [id, check] of [
    [SESSION_RULES.longContext, longContext],
    [SESSION_RULES.topModel, topModel],
  ] as const) {
    if (quiet.has(id)) continue;
    const nudge = check(input);
    if (nudge) return nudge;
  }
  return null;
};
