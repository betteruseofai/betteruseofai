import { join } from 'node:path';

import datasetBundle from '@betteruseofai/dataset';
import { estimate } from '@betteruseofai/core';
import type { CarbonBasis, Dataset, Estimate, UsageEvent, WaterScope } from '@betteruseofai/core';
import { readClaudeCode, readCodex } from '@betteruseofai/readers';
import type { ReaderResult } from '@betteruseofai/readers';

import { flagBool, flagString, resolveSince } from './args.js';
import type { ParsedArgs } from './args.js';
import { appendLog, defaultLogDir, logSize, readLog } from './log.js';

/**
 * Everything a command needs: the dataset, the events, and the settings that
 * govern how those events are priced.
 */

export interface Context {
  dataset: Dataset;
  now: Date;
  regionCode: string | undefined;
  waterScope: WaterScope;
  carbonBasis: CarbonBasis;
  since: string | undefined;
  until: string | undefined;
  json: boolean;
  colour: boolean;
  ascii: boolean;
  sources: string[];
  /**
   * Where the event log lives, or null when this run leaves it alone. A run
   * pointed at another directory with --dir is a fixture or somebody else's
   * transcripts, and writing those into the real log would be wrong, so the
   * log is off for it unless --log or BUAI_LOG_DIR says otherwise.
   */
  logDir: string | null;
}

/*
 * Imported as a module rather than read off disk. Reading the file needed
 * createRequire, which esbuild cannot follow, so the plugin bundle came out
 * unable to find its own dataset. Importing it means the numbers travel with
 * the code, which is what the no-network promise requires anyway.
 */
export const loadDataset = (): Dataset => datasetBundle as unknown as Dataset;

const WATER_SCOPES: WaterScope[] = ['on-site', 'on-site + off-site', 'lifecycle'];

export const buildContext = (args: ParsedArgs): { context: Context; errors: string[] } => {
  const errors: string[] = [];
  const nowFlag = flagString(args.flags, 'now');
  const now = nowFlag ? new Date(nowFlag) : new Date();
  if (Number.isNaN(now.getTime())) errors.push(`--now is not a date I can read: ${nowFlag}`);

  const scopeFlag = flagString(args.flags, 'water-scope');
  if (scopeFlag && !WATER_SCOPES.includes(scopeFlag as WaterScope)) {
    errors.push(`--water-scope must be one of: ${WATER_SCOPES.join(', ')}`);
  }

  const basisFlag = flagString(args.flags, 'carbon-basis');
  if (basisFlag && basisFlag !== 'location-based' && basisFlag !== 'provider-reported') {
    errors.push('--carbon-basis must be location-based or provider-reported.');
  }

  const requested = flagString(args.flags, 'source');
  const sources = requested ? requested.split(',').map((one) => one.trim()) : ['claude-code', 'codex'];
  for (const source of sources) {
    if (source !== 'claude-code' && source !== 'codex') {
      errors.push(`--source must be claude-code or codex, or both separated by a comma. Got: ${source}`);
    }
  }

  const dataset = loadDataset();
  const regionCode = flagString(args.flags, 'region');
  if (regionCode && !dataset.regions.some((region) => region.code === regionCode)) {
    errors.push(
      `We have no grid figures for the region "${regionCode}". Run "betteruseofai models --all" to see the list.`,
    );
  }

  const logFlag = flagString(args.flags, 'log');
  const logOn =
    !flagBool(args.flags, 'no-log') &&
    (logFlag !== undefined || Boolean(process.env['BUAI_LOG_DIR']) || flagString(args.flags, 'dir') === undefined);

  return {
    context: {
      dataset,
      now,
      regionCode,
      waterScope: (scopeFlag as WaterScope) ?? 'on-site + off-site',
      carbonBasis: (basisFlag as CarbonBasis) ?? 'location-based',
      since: resolveSince(flagString(args.flags, 'since'), now),
      until: flagString(args.flags, 'until'),
      json: flagBool(args.flags, 'json') || flagString(args.flags, 'format') === 'json',
      // NO_COLOR is the convention (no-color.org): any value at all switches
      // colour off, and so does a pipe, and so does the flag.
      colour:
        !flagBool(args.flags, 'no-color') &&
        !(process.env['NO_COLOR'] ?? '') &&
        process.stdout.isTTY === true,
      ascii: flagBool(args.flags, 'ascii'),
      sources,
      logDir: logOn ? (logFlag ?? defaultLogDir()) : null,
    },
    errors,
  };
};

export interface LogSummary {
  enabled: boolean;
  /** Turns in the window that exist only in the log, their transcripts gone. */
  fromLogOnly: number;
  /** Lines this run appended, which is how the log fills in the first place. */
  appended: number;
  files: number;
  bytes: number;
}

export interface Loaded {
  events: UsageEvent[];
  estimates: Estimate[];
  pairs: Array<{ event: UsageEvent; estimate: Estimate }>;
  readers: ReaderResult[];
  log: LogSummary;
}

/** The surface a --source name reads. */
const SURFACE_OF: Record<string, string> = { 'claude-code': 'claude-code', codex: 'codex-cli' };

export const loadEvents = async (context: Context, args: ParsedArgs): Promise<Loaded> => {
  const dir = flagString(args.flags, 'dir');
  const options = {
    ...(context.since ? { since: context.since } : {}),
    ...(context.until ? { until: context.until } : {}),
  };

  const results: ReaderResult[] = [];
  if (context.sources.includes('claude-code')) {
    results.push(await readClaudeCode({ ...options, ...(dir ? { dir: join(dir, 'projects') } : {}) }));
  }
  if (context.sources.includes('codex')) {
    results.push(await readCodex({ ...options, ...(dir ? { dir } : {}) }));
  }

  const fromTranscripts = results.flatMap((result) => result.events);

  /*
   * The log joins in two directions. Whatever the transcripts hold that the log
   * does not is appended, so the log fills as a side effect of looking. And
   * whatever the log holds that no transcript does any more is read back, so a
   * turn does not vanish from the totals on the day its transcript is deleted.
   * A turn in both is taken from the transcript, which carries more detail.
   */
  const log: LogSummary = { enabled: context.logDir !== null, fromLogOnly: 0, appended: 0, files: 0, bytes: 0 };
  let logOnly: UsageEvent[] = [];
  if (context.logDir) {
    const stored = readLog(context.logDir);
    const known = new Set(stored.events.map((event) => event.id));
    const missing = fromTranscripts.filter((event) => !known.has(event.id));
    log.appended = appendLog(context.logDir, missing, context.now.toISOString());

    const seen = new Set(fromTranscripts.map((event) => event.id));
    const surfaces = new Set(context.sources.map((source) => SURFACE_OF[source] ?? source));
    logOnly = stored.events.filter(
      (event) =>
        !seen.has(event.id) &&
        surfaces.has(event.surface) &&
        (!context.since || event.timestamp >= context.since) &&
        (!context.until || event.timestamp <= context.until),
    );
    log.fromLogOnly = logOnly.length;
    const size = logSize(context.logDir);
    log.files = size.files;
    log.bytes = size.bytes;
  }

  const events = [...fromTranscripts, ...logOnly].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1,
  );

  const estimates = events.map((event) =>
    estimate(event, {
      dataset: context.dataset,
      ...(context.regionCode ? { regionCode: context.regionCode } : {}),
      waterScope: context.waterScope,
      carbonBasis: context.carbonBasis,
    }),
  );

  return {
    events,
    estimates,
    pairs: events.map((event, index) => ({ event, estimate: estimates[index] as Estimate })),
    readers: results,
    log,
  };
};
