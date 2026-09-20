import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { TokenCounts, UsageEvent } from '@betteruseofai/core';

/**
 * The event log: the history that outlives the transcripts.
 *
 * Claude Code deletes its transcripts after a retention period, thirty days by
 * default, and Codex keeps its own. Everything the tools show is re-priced
 * from those files, so the moment a transcript goes the turns in it vanish
 * from every total. This log is the fix. Both the Stop hook in the plugin and
 * every run of the command line tool append the turns they read here, and the
 * dashboard reads it back beside whatever transcripts still exist.
 *
 * Three rules shape the format.
 *
 * Tokens are stored, never figures. A dataset update then re-prices the whole
 * history rather than freezing the numbers a turn was priced at on the day.
 *
 * One JSON object per line, keys sorted, no spaces, one file per month. It is
 * the same line whether the TypeScript tool or the Python one wrote it, so the
 * two can share a log, and the parity harness compares the bytes.
 *
 * Append only. A turn that appears twice, because a message was revised in a
 * later chunk or two writers overlapped, is resolved when the log is read:
 * the last line for an id wins. Nothing has to read the log to write to it,
 * which is what lets a hook with a ten second budget append and leave. The
 * prune command compacts.
 *
 * Where it lives is deliberate. The plugin's per-session caches sit under the
 * plugin's own data directory, which Claude Code hands to hooks and nobody
 * else. A log that two different writers must find has to be somewhere both
 * agree on, so it is under the Claude configuration directory regardless of
 * which tool is writing, and BUAI_LOG_DIR overrides it for tests and for
 * anyone who wants it elsewhere.
 */

export const LOG_VERSION = 1;

export interface LogLine {
  v: number;
  id: string;
  ts: string;
  recorded: string;
  surface: string;
  hosting: 'cloud' | 'local';
  model: string;
  session?: string;
  region?: string;
  project?: string;
  branch?: string;
  tokens: {
    input: number;
    output: number;
    cachedRead: number;
    cachedWrite: number;
    /** A number is a count, null is undisclosed, and absent means the model cannot think. */
    thinking?: number | null;
    tool?: number;
    estimated?: true;
    estimator?: string;
  };
}

export const defaultLogDir = (): string =>
  process.env['BUAI_LOG_DIR'] ??
  join(process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude'), 'betteruseofai', 'log');

/** The directory the dashboard file is written to, beside the log rather than in it. */
export const defaultOutDir = (logDir: string): string => join(logDir, '..');

const monthOf = (timestamp: string): string => timestamp.slice(0, 7);

/** Keys sorted by code point, no spaces: the same bytes the Python tool writes. */
const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
};

export const toLine = (event: UsageEvent, recorded: string): LogLine => {
  const tokens = event.tokens;
  const line: LogLine = {
    v: LOG_VERSION,
    id: event.id,
    ts: event.timestamp,
    recorded,
    surface: event.surface,
    hosting: event.hosting,
    model: event.modelRaw,
    tokens: {
      input: tokens.input ?? 0,
      output: tokens.output ?? 0,
      cachedRead: tokens.cachedRead ?? 0,
      cachedWrite: tokens.cachedWrite ?? 0,
    },
  };
  if (tokens.thinking !== undefined) line.tokens.thinking = tokens.thinking;
  if (tokens.tool) line.tokens.tool = tokens.tool;
  if (tokens.estimated) {
    line.tokens.estimated = true;
    line.tokens.estimator = tokens.estimator;
  }
  if (event.sessionId) line.session = event.sessionId;
  if (event.regionHint) line.region = event.regionHint;
  const project = event.meta?.['project'];
  if (typeof project === 'string' && project) line.project = project;
  const branch = event.meta?.['branch'];
  if (typeof branch === 'string' && branch) line.branch = branch;
  return line;
};

export const serialise = (line: LogLine): string => JSON.stringify(sortKeys(line));

export const fromLine = (line: LogLine, file: string): UsageEvent => {
  const tokens: TokenCounts = {
    input: line.tokens.input,
    output: line.tokens.output,
    cachedRead: line.tokens.cachedRead,
    cachedWrite: line.tokens.cachedWrite,
    estimated: line.tokens.estimated === true,
    estimator: line.tokens.estimator ?? 'provider',
  };
  if ('thinking' in line.tokens) tokens.thinking = line.tokens.thinking;
  if (line.tokens.tool) tokens.tool = line.tokens.tool;
  return {
    id: line.id,
    surface: line.surface,
    hosting: line.hosting,
    modelRaw: line.model,
    modelId: null,
    tokens,
    timestamp: line.ts,
    ...(line.session ? { sessionId: line.session } : {}),
    ...(line.region ? { regionHint: line.region } : {}),
    meta: {
      file,
      fromLog: true,
      ...(line.project ? { project: line.project } : {}),
      ...(line.branch ? { branch: line.branch } : {}),
    },
  };
};

const isLine = (value: unknown): value is LogLine =>
  typeof value === 'object' &&
  value !== null &&
  (value as LogLine).v === LOG_VERSION &&
  typeof (value as LogLine).id === 'string' &&
  typeof (value as LogLine).ts === 'string' &&
  typeof (value as LogLine).tokens === 'object';

const monthFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}\.jsonl$/.test(name))
    .sort()
    .map((name) => join(dir, name));
};

export interface LogRead {
  events: UsageEvent[];
  /** Lines that were superseded by a later line for the same id. */
  duplicates: number;
  /** Lines that could not be read as a log line and were skipped. */
  skipped: number;
  files: number;
  bytes: number;
}

/** Every event in the log, the last line for an id winning, in timestamp order. */
export const readLog = (dir: string): LogRead => {
  const byId = new Map<string, UsageEvent>();
  let duplicates = 0;
  let skipped = 0;
  let bytes = 0;
  const files = monthFiles(dir);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    bytes += Buffer.byteLength(text, 'utf8');
    for (const raw of text.split('\n')) {
      const trimmed = raw.trim();
      if (trimmed === '') continue;
      let value: unknown;
      try {
        value = JSON.parse(trimmed);
      } catch {
        skipped += 1;
        continue;
      }
      if (!isLine(value)) {
        skipped += 1;
        continue;
      }
      if (byId.has(value.id)) duplicates += 1;
      byId.set(value.id, fromLine(value, file));
    }
  }
  const events = [...byId.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1,
  );
  return { events, duplicates, skipped, files: files.length, bytes };
};

/** Appends these events, one line each, to the month file their timestamp falls in. */
export const appendLog = (dir: string, events: UsageEvent[], recorded: string): number => {
  if (events.length === 0) return 0;
  mkdirSync(dir, { recursive: true });
  const byMonth = new Map<string, string[]>();
  for (const event of events) {
    const month = monthOf(event.timestamp);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const lines = byMonth.get(month) ?? [];
    lines.push(serialise(toLine(event, recorded)));
    byMonth.set(month, lines);
  }
  let written = 0;
  for (const [month, lines] of [...byMonth.entries()].sort()) {
    appendFileSync(join(dir, `${month}.jsonl`), `${lines.join('\n')}\n`, 'utf8');
    written += lines.length;
  }
  return written;
};

export interface LogSize {
  files: number;
  bytes: number;
}

export const logSize = (dir: string): LogSize => {
  const files = monthFiles(dir);
  return { files: files.length, bytes: files.reduce((total, file) => total + statSync(file).size, 0) };
};

/** Above this the dashboard and the doctor suggest pruning. */
export const LOG_WARN_BYTES = 200 * 1024 * 1024;

export interface PruneResult {
  removed: number;
  duplicates: number;
  kept: number;
  filesBefore: number;
  filesAfter: number;
  bytesBefore: number;
  bytesAfter: number;
}

/**
 * Drops every turn before a moment and compacts what is left, so each id
 * appears once. With dryRun nothing is written and the counts say what would
 * have happened.
 */
export const pruneLog = (dir: string, before: string | null, dryRun: boolean): PruneResult => {
  const files = monthFiles(dir);
  const before_ = before ?? '';
  let removed = 0;
  let duplicates = 0;
  let kept = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  let filesAfter = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    bytesBefore += Buffer.byteLength(text, 'utf8');
    const last = new Map<string, LogLine>();
    for (const raw of text.split('\n')) {
      const trimmed = raw.trim();
      if (trimmed === '') continue;
      let value: unknown;
      try {
        value = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isLine(value)) continue;
      if (last.has(value.id)) duplicates += 1;
      last.set(value.id, value);
    }
    const survivors = [...last.values()].filter((line) => {
      const keep = before_ === '' || line.ts >= before_;
      if (!keep) removed += 1;
      return keep;
    });
    kept += survivors.length;
    if (survivors.length > 0) {
      const out = `${survivors.map(serialise).join('\n')}\n`;
      bytesAfter += Buffer.byteLength(out, 'utf8');
      filesAfter += 1;
      if (!dryRun) writeFileSync(file, out, 'utf8');
    } else if (!dryRun) {
      rmSync(file);
    }
  }

  return { removed, duplicates, kept, filesBefore: files.length, filesAfter, bytesBefore, bytesAfter };
};
