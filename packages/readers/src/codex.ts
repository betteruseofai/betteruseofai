import { homedir } from 'node:os';
import { basename, join } from 'node:path';

import type { TokenCounts, UsageEvent } from '@betteruseofai/core';

import { exists, readJsonl, walk } from './jsonl.js';
import type { Reader, ReaderOptions, ReaderResult, ReaderWarning } from './types.js';

/**
 * Reads Codex CLI rollouts from ~/.codex/sessions and archived_sessions.
 *
 * The awkward part of this format is that a token_count event carries both a
 * running total for the session and the usage of the last turn. We prefer the
 * per-turn figure. Where it is missing we difference the running total against
 * the previous one, and we clamp a negative difference to zero rather than
 * subtracting: a subagent replay inherits its parent's snapshot, so the total
 * can go backwards, and treating that as negative energy would be worse than
 * dropping it.
 *
 * Two more traps. cached_input_tokens is a subset of input_tokens, not an
 * addition to it, so the cached share is taken out before the rest is charged.
 * And reasoning_output_tokens is inside output_tokens for the same reason.
 */

export const CODEX_SURFACE = 'codex-cli';

/** Token counts only started appearing in rollouts on this date. */
export const CODEX_TOKENS_FROM = '2025-09-06';

interface Usage {
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

interface RolloutLine {
  type?: string;
  timestamp?: string;
  payload?: {
    type?: string;
    id?: string;
    model?: string;
    total_token_usage?: Usage;
    last_token_usage?: Usage;
    info?: {
      total_token_usage?: Usage;
      last_token_usage?: Usage;
      model_context_window?: number;
    };
  };
}

export const defaultCodexDir = (): string =>
  process.env['CODEX_HOME'] ?? join(homedir(), '.codex');

const difference = (current: Usage, previous: Usage): Usage => {
  const at = (usage: Usage, key: keyof Usage): number => usage[key] ?? 0;
  const keys: Array<keyof Usage> = [
    'input_tokens',
    'cached_input_tokens',
    'cache_write_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
  ];
  const result: Usage = {};
  for (const key of keys) {
    // A replay can carry a smaller running total than the turn before it. That
    // is a reset, not a saving, so it contributes nothing rather than a negative.
    result[key] = Math.max(0, at(current, key) - at(previous, key));
  }
  return result;
};

const isEmpty = (usage: Usage): boolean =>
  (usage.input_tokens ?? 0) === 0 &&
  (usage.output_tokens ?? 0) === 0 &&
  (usage.cached_input_tokens ?? 0) === 0 &&
  (usage.cache_write_input_tokens ?? 0) === 0;

const toTokens = (usage: Usage): TokenCounts => {
  const cachedRead = usage.cached_input_tokens ?? 0;
  const reasoning = usage.reasoning_output_tokens ?? 0;
  return {
    // Both of these are subsets of the figure they sit inside, so they come out
    // of it rather than being added on top.
    input: Math.max(0, (usage.input_tokens ?? 0) - cachedRead),
    output: Math.max(0, (usage.output_tokens ?? 0) - reasoning),
    cachedRead,
    cachedWrite: usage.cache_write_input_tokens ?? 0,
    thinking: reasoning,
    estimated: false,
    estimator: 'provider',
  };
};

const withinWindow = (event: UsageEvent, options: ReaderOptions): boolean => {
  if (options.since && event.timestamp < options.since) return false;
  if (options.until && event.timestamp > options.until) return false;
  if (options.sessionId && event.sessionId !== options.sessionId) return false;
  return true;
};

/** Parses one rollout file into events. Exported so the tests can aim at a single file. */
export const readCodexRollout = async (
  file: string,
  warnings: ReaderWarning[],
  skipped: ReaderResult['skipped'],
): Promise<UsageEvent[]> => {
  const events: UsageEvent[] = [];
  const sessionId = basename(file).replace(/^rollout-/, '').replace(/\.jsonl$/, '');

  let model: string | null = null;
  let previousTotal: Usage = {};
  let turn = 0;

  for await (const { line, value, error } of readJsonl(file)) {
    if (error) {
      warnings.push({ file, line, message: `Could not parse this line, so it was skipped: ${error}` });
      continue;
    }
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as RolloutLine;
    const payload = entry.payload;
    if (!payload) continue;

    // The model can change part way through a session, so it is tracked rather
    // than read once at the top.
    if (entry.type === 'turn_context' || payload.type === 'turn_context') {
      if (typeof payload.model === 'string') model = payload.model;
      continue;
    }

    const isTokenCount = payload.type === 'token_count' || entry.type === 'token_count';
    if (!isTokenCount) continue;

    const info = payload.info ?? payload;
    const last = info.last_token_usage;
    const total = info.total_token_usage;

    let usage: Usage | null = null;
    let basis: 'per-turn' | 'differenced' = 'per-turn';

    if (last && !isEmpty(last)) {
      usage = last;
    } else if (total) {
      usage = difference(total, previousTotal);
      basis = 'differenced';
    }

    if (total) previousTotal = total;
    if (!usage || isEmpty(usage)) {
      skipped.noUsage += 1;
      continue;
    }

    turn += 1;
    events.push({
      id: `${sessionId}:${turn}`,
      surface: CODEX_SURFACE,
      hosting: 'cloud',
      modelRaw: model ?? '',
      modelId: null,
      tokens: toTokens(usage),
      timestamp: entry.timestamp ?? '',
      sessionId,
      meta: { file, basis, turn },
    });
  }

  return events;
};

export const readCodex = async (options: ReaderOptions = {}): Promise<ReaderResult> => {
  const home = options.dir ?? defaultCodexDir();
  const warnings: ReaderWarning[] = [];
  const skipped = { synthetic: 0, apiError: 0, duplicate: 0, noUsage: 0 };

  const roots = [join(home, 'sessions'), join(home, 'archived_sessions')];
  const files: string[] = [];
  for (const root of roots) {
    if (await exists(root)) files.push(...(await walk(root, (name) => name.endsWith('.jsonl'))));
  }

  if (files.length === 0) {
    return {
      events: [],
      warnings: [
        {
          file: home,
          message:
            'No Codex CLI rollouts here. Note that rollouts written before 6 September 2025 carry no token counts at all.',
        },
      ],
      files: [],
      skipped,
    };
  }

  const events: UsageEvent[] = [];
  for (const file of files) events.push(...(await readCodexRollout(file, warnings, skipped)));

  const filtered = events
    .filter((event) => withinWindow(event, options))
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1));

  return { events: filtered, warnings, files, skipped };
};

export const codexReader: Reader = {
  id: 'codex',
  surface: CODEX_SURFACE,
  defaultDir: defaultCodexDir,
  read: readCodex,
};
