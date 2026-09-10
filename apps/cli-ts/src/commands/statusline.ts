import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  aggregate,
  createRecommender,
  displayNumber,
  estimate,
  formatRange,
  getModel,
  scaleUnit,
} from '@betteruseofai/core';
import type { Estimate, UsageEvent } from '@betteruseofai/core';
import { readClaudeCodeIncremental } from '@betteruseofai/readers';
import type { IncrementalState } from '@betteruseofai/readers';

import { flagBool } from '../args.js';
import type { ParsedArgs } from '../args.js';
import type { Context } from '../context.js';

/**
 * The Claude Code status line, and the hooks that feed it.
 *
 * Claude Code debounces the status line at 300 ms and expects an answer in tens
 * of milliseconds, so this never reads a whole transcript. It keeps a byte
 * offset and a running total per session in a small cache file, and parses only
 * what has been appended since it last looked.
 */

export interface StatuslineInput {
  session_id?: string;
  transcript_path?: string;
  model?: { id?: string; display_name?: string };
  context_window?: { used_tokens?: number; max_tokens?: number };
  cost?: { total_cost_usd?: number };
  hook_event_name?: string;
}

interface Cached {
  state: IncrementalState;
  /** Keyed the same way the reader keys events, so a revision replaces rather than adds. */
  events: Record<string, UsageEvent>;
  updated: string;
}

export const stateDir = (): string =>
  process.env['BUOA_STATE_DIR'] ??
  join(process.env['CLAUDE_PLUGIN_DATA'] ?? join(homedir(), '.claude'), 'betteruseofai', 'state');

const safeName = (sessionId: string): string => sessionId.replace(/[^A-Za-z0-9_-]/g, '_');

const cachePath = (sessionId: string): string => join(stateDir(), `${safeName(sessionId)}.json`);

/**
 * The rendered status line, kept as plain text next to the cache.
 *
 * Measured on this machine, bare Node start-up is 104 ms and the whole tool
 * only adds about 20 ms on top. The plan asked for tens of milliseconds, which
 * no Node process on Windows can meet. So the line is rendered whenever we are
 * running anyway, written here, and the cheap path just reads the file. A shell
 * shim can read it directly and never start Node at all.
 */
export const linePath = (sessionId: string): string => join(stateDir(), `${safeName(sessionId)}.line`);

export const readCheapLine = (sessionId: string): string | null => {
  try {
    return readFileSync(linePath(sessionId), 'utf8').trimEnd();
  } catch {
    return null;
  }
};

const writeLine = (sessionId: string, line: string): void => {
  try {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(linePath(sessionId), `${line}\n`, 'utf8');
  } catch {
    // A status line that cannot cache is still a status line.
  }
};

const readCache = (sessionId: string): Cached => {
  try {
    return JSON.parse(readFileSync(cachePath(sessionId), 'utf8')) as Cached;
  } catch {
    return { state: { offset: 0, seen: {} }, events: {}, updated: '' };
  }
};

const writeCache = (sessionId: string, cached: Cached): void => {
  const path = cachePath(sessionId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cached), 'utf8');
};

export interface SessionTotals {
  turns: number;
  estimates: Estimate[];
  events: UsageEvent[];
}

/**
 * Brings the cached total for one session up to date and returns it.
 *
 * Events are stored rather than a running sum, so a change to the dataset
 * re-prices the whole session instead of leaving stale numbers behind.
 */
export const refreshSession = async (
  context: Context,
  sessionId: string,
  transcriptPath: string,
): Promise<SessionTotals> => {
  const cached = readCache(sessionId);
  const { added, state } = await readClaudeCodeIncremental(transcriptPath, cached.state);

  const events = { ...cached.events };
  for (const event of added) events[event.id] = event;

  writeCache(sessionId, { state, events, updated: context.now.toISOString() });

  const list = Object.values(events).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  return {
    turns: list.length,
    events: list,
    estimates: list.map((event) =>
      estimate(event, {
        dataset: context.dataset,
        ...(context.regionCode ? { regionCode: context.regionCode } : {}),
        waterScope: context.waterScope,
        carbonBasis: context.carbonBasis,
      }),
    ),
  };
};

/**
 * Reads the payload from standard input.
 *
 * Returns nothing at once when there is no pipe. Both of these commands are
 * meant to be fed by Claude Code, and someone who types the command by hand
 * should get an empty answer rather than a terminal that hangs with no
 * explanation.
 */
export const readStdin = async (): Promise<string> => {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

export const parseStdinJson = <T>(text: string): T | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
};

/** One line, under 80 characters, that has to be right more than it has to be full. */
export const statusline = async (context: Context, args: ParsedArgs): Promise<string> => {
  const input = parseStdinJson<StatuslineInput>(await readStdin());
  if (!input?.session_id || !input.transcript_path) {
    // Nothing to say is better than a wrong number. An empty line is a valid
    // status line and Claude Code renders it as no status line at all.
    return '';
  }

  const ascii = context.ascii || flagBool(args.flags, 'ascii');

  const totals = await refreshSession(context, input.session_id, input.transcript_path);
  if (totals.turns === 0) return '';

  const [rolled] = aggregate(
    totals.events.map((event, index) => ({ event, estimate: totals.estimates[index] as Estimate })),
    'all',
  );
  if (!rolled) return '';

  const parts: string[] = [];
  parts.push(
    formatRange(rolled.energyWh, { unit: 'Wh', bounds: false, flags: rolled.flags, ascii }),
  );
  for (const [value, unit] of [
    [rolled.waterMl, 'mL'],
    [rolled.carbonG, 'g'],
  ] as const) {
    if (!value) continue;
    const scaled = scaleUnit(value.central, unit);
    parts.push(`${displayNumber(scaled.value)} ${scaled.unit}`);
  }

  // The share of the session spent on the largest model, which is the number
  // that actually changes behaviour.
  const byModel = Object.entries(rolled.byModel).sort((a, b) => b[1] - a[1]);
  const top = byModel[0];
  if (top && byModel.length > 0) {
    const name = getModel(top[0], context.dataset)?.displayName ?? top[0];
    parts.push(`${name} ${Math.round((top[1] / rolled.count) * 100)}%`);
  }

  const window = input.context_window;
  if (window?.used_tokens && window.max_tokens) {
    parts.push(`ctx ${Math.round((window.used_tokens / window.max_tokens) * 100)}%`);
  }

  const line = parts.join(' · ');
  writeLine(input.session_id, line);
  return line;
};

export interface HookInput extends StatuslineInput {
  prompt?: string;
  stop_hook_active?: boolean;
}

/**
 * Hook handler. Always exits zero and always emits valid JSON, because a hook
 * that fails noisily is a hook the user turns off.
 */
export const hook = async (context: Context, args: ParsedArgs): Promise<string> => {
  const event = args.positional[0] ?? '';
  const input = parseStdinJson<HookInput>(await readStdin());

  const say = (message: string | null): string =>
    JSON.stringify(message === null ? {} : { systemMessage: message });

  if (!input?.session_id || !input.transcript_path) return say(null);

  if (event === 'Stop') {
    const totals = await refreshSession(context, input.session_id, input.transcript_path);
    if (totals.turns === 0) return say(null);

    const [rolled] = aggregate(
      totals.events.map((one, index) => ({ event: one, estimate: totals.estimates[index] as Estimate })),
      'all',
    );
    if (!rolled) return say(null);

    // Keep the cheap status line fresh while we are running anyway.
    const cached: string[] = [
      formatRange(rolled.energyWh, { unit: 'Wh', bounds: false, flags: rolled.flags, ascii: true }),
    ];
    for (const [value, unit] of [
      [rolled.waterMl, 'mL'],
      [rolled.carbonG, 'g'],
    ] as const) {
      if (!value) continue;
      const scaled = scaleUnit(value.central, unit);
      cached.push(`${displayNumber(scaled.value)} ${scaled.unit}`);
    }
    writeLine(input.session_id, cached.join(' · '));

    // Say something every tenth turn rather than after every one. A meter that
    // interrupts constantly gets switched off, and then it measures nothing.
    if (rolled.count % 10 !== 0) return say(null);

    const byModel = Object.entries(rolled.byModel).sort((a, b) => b[1] - a[1]);
    const top = byModel[0];
    const share = top ? ` · ${Math.round((top[1] / rolled.count) * 100)}% ${getModel(top[0], context.dataset)?.displayName ?? top[0]}` : '';

    return say(
      `Session so far: ${cached.join(', ')} across ${rolled.count} turns${share}`,
    );
  }

  if (event === 'UserPromptSubmit') {
    const prompt = input.prompt ?? '';
    if (prompt.trim() === '') return say(null);

    /*
     * A coding session is the worst place to be interrupted, so the bar here is
     * higher than the default and two rules are muted outright. no-llm.arithmetic
     * would fire on a line of a calculation being discussed, and
     * downgrade.short-simple on a one-line follow-up that only makes sense with
     * the whole session behind it. A nudge that fires wrongly gets the feature
     * switched off, and then nothing is measured at all.
     */
    const recommender = createRecommender({
      dataset: context.dataset,
      hintThreshold: 0.75,
      muted: ['no-llm.arithmetic', 'no-llm.unit-conversion', 'downgrade.short-simple'],
    });

    const advice = recommender.recommend({
      prompt,
      modelId: input.model?.id ?? null,
      surface: 'claude-code',
    });

    if (!advice.showAsHint) return say(null);

    const saving = advice.estimatedSavings?.energyWh;
    if (!saving) return say(advice.explanation);
    // The explanation ends in a full stop, so the saving becomes its own sentence
    // rather than being bolted on after the punctuation.
    return say(`${advice.explanation} That would save roughly ${displayNumber(saving.central)} Wh.`);
  }

  if (event === 'PostModelSwitch' || event === 'SessionStart') {
    // Nothing to say. The switch is recorded by the next Stop hook anyway.
    return say(null);
  }

  return say(null);
};
