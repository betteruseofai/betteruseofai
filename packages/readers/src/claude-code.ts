import { homedir } from 'node:os';
import { join } from 'node:path';

import type { TokenCounts, UsageEvent } from '@betteruseofai/core';

import { exists, readJsonl, readJsonlSince, walk } from './jsonl.js';
import type { IncrementalState, Reader, ReaderOptions, ReaderResult, ReaderWarning } from './types.js';
import { emptyIncrementalState } from './types.js';

/**
 * Reads Claude Code transcripts from ~/.claude/projects.
 *
 * Two things about this format matter more than the rest.
 *
 * A message appears once per content block, so the same message id and request
 * id turn up several times with identical usage. On one real session here, 76
 * of 157 messages were repeated; counting them all would have inflated the
 * total by about half. We key on message id plus request id and keep the last
 * copy, which is also the right behaviour if a later chunk revises the counts.
 *
 * And a line whose model is <synthetic> was written by the client, not by a
 * model. Its usage is all zeroes. Counting it as an unrecognised model would
 * put a false unknown in every session, so it is skipped and reported.
 */

export const CLAUDE_CODE_SURFACE = 'claude-code';

interface AssistantLine {
  type?: string;
  requestId?: string;
  timestamp?: string;
  sessionId?: string;
  isApiErrorMessage?: boolean;
  isSidechain?: boolean;
  cwd?: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
      output_tokens_details?: { thinking_tokens?: number | null } | null;
      inference_geo?: string | null;
      server_tool_use?: Record<string, number> | null;
    } | null;
  };
}

/** The provider writes this when it has nothing to report, and it is not a region. */
const NOT_A_REGION = new Set(['not_available', 'unknown', '']);

export const defaultClaudeDir = (): string =>
  process.env['BUAI_CLAUDE_DIR'] ?? join(process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude'), 'projects');

/** True when the line is an assistant turn we should count. */
const classify = (
  value: unknown,
): { kind: 'count'; line: AssistantLine } | { kind: 'skip'; reason: keyof ReaderResult['skipped'] } | null => {
  if (typeof value !== 'object' || value === null) return null;
  const line = value as AssistantLine;
  if (line.type !== 'assistant') return null;
  const model = line.message?.model;
  if (model === undefined) return { kind: 'skip', reason: 'noUsage' };
  if (model === '<synthetic>') return { kind: 'skip', reason: 'synthetic' };
  if (line.isApiErrorMessage === true) return { kind: 'skip', reason: 'apiError' };
  if (!line.message?.usage) return { kind: 'skip', reason: 'noUsage' };
  return { kind: 'count', line };
};

const toEvent = (line: AssistantLine, file: string): UsageEvent => {
  const usage = line.message?.usage ?? {};
  const details = usage.output_tokens_details;

  /*
   * A null details object means the client wrote no thinking figure at all,
   * which is different from a model that cannot think. We pass null through so
   * the engine treats it as undisclosed rather than as none.
   */
  const thinking: number | null | undefined =
    details === null
      ? null
      : details?.thinking_tokens === null
        ? null
        : typeof details?.thinking_tokens === 'number'
          ? details.thinking_tokens
          : null;

  const serverTools = usage.server_tool_use ?? {};
  const toolCalls = Object.values(serverTools).reduce((total, count) => total + (count ?? 0), 0);

  const tokens: TokenCounts = {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cachedRead: usage.cache_read_input_tokens ?? 0,
    cachedWrite: usage.cache_creation_input_tokens ?? 0,
    thinking,
    estimated: false,
    estimator: 'provider',
  };

  const geo = usage.inference_geo;
  const regionHint = geo && !NOT_A_REGION.has(geo) ? geo.toUpperCase() : undefined;

  return {
    id: `${line.message?.id ?? 'unknown'}:${line.requestId ?? 'no-request'}`,
    surface: CLAUDE_CODE_SURFACE,
    hosting: 'cloud',
    modelRaw: line.message?.model ?? '',
    modelId: null,
    tokens,
    timestamp: line.timestamp ?? '',
    sessionId: line.sessionId,
    ...(regionHint ? { regionHint } : {}),
    meta: {
      file,
      ...(toolCalls > 0 ? { serverToolCalls: toolCalls } : {}),
      ...(line.isSidechain ? { sidechain: true } : {}),
      ...(line.cwd ? { project: line.cwd } : {}),
    },
  };
};

const keyOf = (line: AssistantLine): string =>
  `${line.message?.id ?? 'no-id'}:${line.requestId ?? 'no-request'}`;

const withinWindow = (event: UsageEvent, options: ReaderOptions): boolean => {
  if (options.since && event.timestamp < options.since) return false;
  if (options.until && event.timestamp > options.until) return false;
  if (options.sessionId && event.sessionId !== options.sessionId) return false;
  return true;
};

export const readClaudeCode = async (options: ReaderOptions = {}): Promise<ReaderResult> => {
  const dir = options.dir ?? defaultClaudeDir();
  const warnings: ReaderWarning[] = [];
  const skipped = { synthetic: 0, apiError: 0, duplicate: 0, noUsage: 0 };

  if (!(await exists(dir))) {
    return {
      events: [],
      warnings: [{ file: dir, message: 'No Claude Code transcripts here. Nothing to report.' }],
      files: [],
      skipped,
    };
  }

  const files = await walk(dir, (name) => name.endsWith('.jsonl'));

  /*
   * Keyed by message id and request id, so a repeated content block replaces
   * the earlier copy instead of adding to it. Insertion order is preserved,
   * which keeps the output in transcript order.
   */
  const byKey = new Map<string, UsageEvent>();

  for (const file of files) {
    for await (const { line, value, error } of readJsonl(file)) {
      if (error) {
        warnings.push({ file, line, message: `Could not parse this line, so it was skipped: ${error}` });
        continue;
      }
      const verdict = classify(value);
      if (verdict === null) continue;
      if (verdict.kind === 'skip') {
        skipped[verdict.reason] += 1;
        continue;
      }
      const key = keyOf(verdict.line);
      if (byKey.has(key)) skipped.duplicate += 1;
      byKey.set(key, toEvent(verdict.line, file));
    }
  }

  const events = [...byKey.values()]
    .filter((event) => withinWindow(event, options))
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1));

  return { events, warnings, files, skipped };
};

/**
 * Reads only what has been appended to one transcript since the last call.
 *
 * This is what the status line uses. It carries the keys of messages already
 * counted, so a message revised in a later chunk supersedes the earlier copy
 * and the caller can subtract before adding.
 */
export const readClaudeCodeIncremental = async (
  path: string,
  state: IncrementalState = emptyIncrementalState(),
): Promise<{ added: UsageEvent[]; superseded: string[]; state: IncrementalState }> => {
  const { lines, offset, restarted } = await readJsonlSince(path, state.offset);
  const seen = restarted ? {} : { ...state.seen };
  const added: UsageEvent[] = [];
  const superseded: string[] = [];

  for (const { value } of lines) {
    const verdict = classify(value);
    if (verdict === null || verdict.kind === 'skip') continue;
    const key = keyOf(verdict.line);
    if (seen[key] !== undefined) superseded.push(key);
    seen[key] = (seen[key] ?? 0) + 1;
    added.push(toEvent(verdict.line, path));
  }

  return { added, superseded, state: { offset, seen } };
};

export const claudeCodeReader: Reader = {
  id: 'claude-code',
  surface: CLAUDE_CODE_SURFACE,
  defaultDir: defaultClaudeDir,
  read: readClaudeCode,
};
