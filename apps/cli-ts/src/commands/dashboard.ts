import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import {
  aggregate,
  canonicalNumber,
  displayNumber,
  equivalents,
  getModel,
  saving as computeSaving,
  scaleUnit,
} from '@betteruseofai/core';
import type { Aggregate, EstimateFlag, Range, Saving } from '@betteruseofai/core';

import { flagBool, flagString, resolveSince } from '../args.js';
import type { ParsedArgs } from '../args.js';
import type { Context } from '../context.js';
import { loadEvents } from '../context.js';
import { DASHBOARD_TEMPLATE } from '../generated/dashboard-template.js';
import { defaultOutDir, LOG_WARN_BYTES, pruneLog } from '../log.js';
import { canonicalJson } from '../canonical.js';
import { caveats, emitJson, paint, payload, rangeOut, short } from '../output.js';

/**
 * The dashboard: every session on this machine, as one file.
 *
 * The command works out everything a reader will see, formats every figure
 * with the same rules the terminal uses, and writes the result as JSON into a
 * template the tokens package built. The script inside the file lays that
 * JSON out and never rounds a number itself, so the Python tool produces the
 * identical file from the identical data and the parity harness can say so.
 *
 * Projects and branches are left out unless asked for. The file is the kind
 * of thing that gets screenshotted, and a directory name travels further in
 * a screenshot than anyone intends.
 */

export const DATA_PLACEHOLDER = '__BUAI_DATA__';

interface Figure {
  prefix: string;
  value: string;
  unit: string;
  low: string;
  high: string;
}

/** The pieces of a readout, worked out the way formatRange does but kept apart for the page. */
const figure = (range: Range | null, unit: string, flags: EstimateFlag[]): Figure | null => {
  if (range === null) return null;
  const lowerBound = flags.includes('thinking-unknown');
  const estimated = flags.includes('tokens-estimated') || flags.includes('derived-rate');
  const scaled = scaleUnit(range.central, unit);
  const divisor = scaled.unit !== unit && scaled.value !== 0 ? range.central / scaled.value : 1;
  return {
    prefix: lowerBound ? '≥ ' : estimated ? '~' : '',
    value: displayNumber(scaled.value),
    unit: scaled.unit,
    low: displayNumber(range.low / divisor),
    high: displayNumber(range.high / divisor),
  };
};

const texts = (one: { energyWh: Range | null; waterMl: Range | null; carbonG: Range | null }) => ({
  energy: short(one.energyWh, 'Wh'),
  water: short(one.waterMl, 'mL'),
  carbon: short(one.carbonG, 'g'),
});

const bucketOut = (one: Aggregate) => ({
  key: one.key,
  count: one.count,
  energyWh: rangeOut(one.energyWh),
  waterMl: rangeOut(one.waterMl),
  carbonG: rangeOut(one.carbonG),
  unknownModelCount: one.unknownModelCount,
  text: texts(one),
});

/** The last part of a working directory, whichever way its slashes lean. */
export const projectName = (path: string | undefined): string => {
  if (!path) return 'unknown project';
  const parts = path.split(/[\\/]+/).filter((part) => part !== '');
  return parts[parts.length - 1] ?? 'unknown project';
};

const byCountThenKey = (a: { count: number; key: string }, b: { count: number; key: string }): number =>
  b.count !== a.count ? b.count - a.count : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

export const dashboardPayload = async (context: Context, args: ParsedArgs) => {
  const withProjects = flagBool(args.flags, 'with-projects');
  const loaded = await loadEvents(context, args);
  const { pairs } = loaded;

  const [totals] = aggregate(pairs, 'all');
  const models = aggregate(pairs, 'model').sort(byCountThenKey);
  const surfaces = aggregate(pairs, 'surface').sort(byCountThenKey);
  const sessions = aggregate(pairs, 'session')
    .sort((a, b) => {
      const left = a.energyWh?.central ?? -1;
      const right = b.energyWh?.central ?? -1;
      if (left !== right) return right - left;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .slice(0, 10);

  const options = {
    ...(context.regionCode ? { regionCode: context.regionCode } : {}),
    waterScope: context.waterScope,
    carbonBasis: context.carbonBasis,
  };
  const saved: Saving | null = totals ? computeSaving(pairs, context.dataset, options) : null;

  const projects = withProjects
    ? (() => {
        const groups = new Map<string, { project: string; branch: string | null; count: number; energyWh: Range | null }>();
        for (const { event, estimate } of pairs) {
          const project = projectName(typeof event.meta?.['project'] === 'string' ? (event.meta['project'] as string) : undefined);
          const branchValue = event.meta?.['branch'];
          const branch = typeof branchValue === 'string' && branchValue ? branchValue : null;
          const key = `${project}\n${branch ?? ''}`;
          const group = groups.get(key) ?? { project, branch, count: 0, energyWh: null };
          group.count += 1;
          if (estimate.energyWh) {
            group.energyWh = group.energyWh
              ? {
                  low: group.energyWh.low + estimate.energyWh.low,
                  central: group.energyWh.central + estimate.energyWh.central,
                  high: group.energyWh.high + estimate.energyWh.high,
                }
              : estimate.energyWh;
          }
          groups.set(key, group);
        }
        return [...groups.values()]
          .sort((a, b) =>
            b.count !== a.count
              ? b.count - a.count
              : a.project !== b.project
                ? a.project < b.project
                  ? -1
                  : 1
                : (a.branch ?? '') < (b.branch ?? '')
                  ? -1
                  : (a.branch ?? '') > (b.branch ?? '')
                    ? 1
                    : 0,
          )
          .map((group) => ({
            project: group.project,
            branch: group.branch,
            count: group.count,
            energyWh: rangeOut(group.energyWh),
            text: { energy: short(group.energyWh, 'Wh') },
          }));
      })()
    : null;

  const sessionKeys = new Set(pairs.map(({ event }) => event.sessionId ?? event.conversationId ?? 'no-session'));
  const timestamps = pairs.map(({ event }) => event.timestamp).sort();
  const logMb = Math.round(loaded.log.bytes / (1024 * 1024));

  const quiet: Context = { ...context, colour: false };
  const equivalentsOut = (value: number | null | undefined, quantity: 'energy' | 'water' | 'carbon') =>
    equivalents(value ?? null, quantity, context.dataset, 2).map((one) => ({
      id: one.id,
      count: canonicalNumber(one.count),
      text: one.count.toFixed(1),
      label: one.label,
      stale: one.stale,
    }));

  return {
    command: 'dashboard',
    window: { since: context.since ?? null, until: context.until ?? null },
    settings: {
      region: context.regionCode ?? context.dataset.defaultRegion,
      waterScope: context.waterScope,
      carbonBasis: context.carbonBasis,
    },
    withProjects,
    coverage: {
      turns: pairs.length,
      sessions: sessionKeys.size,
      from: timestamps[0] ?? null,
      to: timestamps[timestamps.length - 1] ?? null,
      fromTranscripts: pairs.length - loaded.log.fromLogOnly,
      fromLogOnly: loaded.log.fromLogOnly,
      appended: loaded.log.appended,
      logEnabled: loaded.log.enabled,
      logFiles: loaded.log.files,
      logBytes: loaded.log.bytes,
      logMb,
      logWarn: loaded.log.bytes > LOG_WARN_BYTES,
    },
    totals: totals
      ? {
          count: totals.count,
          energyWh: rangeOut(totals.energyWh),
          waterMl: rangeOut(totals.waterMl),
          carbonG: rangeOut(totals.carbonG),
          unknownModelCount: totals.unknownModelCount,
          noBenchmarkCount: totals.noBenchmarkCount,
          flags: totals.flags,
          readout: {
            energy: figure(totals.energyWh, 'Wh', totals.flags),
            water: figure(totals.waterMl, 'mL', totals.flags),
            carbon: figure(totals.carbonG, 'g', totals.flags),
          },
        }
      : null,
    byWeek: aggregate(pairs, 'week').map(bucketOut),
    byDay: aggregate(pairs, 'day').map(bucketOut),
    byModel: models.map((one) => ({
      ...bucketOut(one),
      name: one.key === 'unknown' ? 'unknown' : (getModel(one.key, context.dataset)?.displayName ?? one.key),
      share: canonicalNumber(totals ? one.count / totals.count : 0),
    })),
    bySurface: surfaces.map(bucketOut),
    sessions: sessions.map((one) => {
      const top = Object.entries(one.byModel).sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))[0];
      const topModel = top ? (top[0] === 'unknown' ? 'unknown' : (getModel(top[0], context.dataset)?.displayName ?? top[0])) : 'unknown';
      return { ...bucketOut(one), from: one.from, to: one.to, topModel };
    }),
    saving: saved
      ? {
          baseline: saved.baseline,
          energyWh: rangeOut(saved.energyWh),
          waterMl: rangeOut(saved.waterMl),
          carbonG: rangeOut(saved.carbonG),
          skipped: saved.skipped,
          byDay: saved.byDay.map((day) => ({ day: day.day, energyWh: rangeOut(day.energyWh) })),
          readout: { energy: figure(saved.energyWh, 'Wh', []) },
        }
      : null,
    projects,
    equivalents: {
      energy: equivalentsOut(totals?.energyWh?.central, 'energy'),
      water: equivalentsOut(totals?.waterMl?.central, 'water'),
      carbon: equivalentsOut(totals?.carbonG?.central, 'carbon'),
    },
    caveats: totals ? caveats(quiet, totals).map((line) => line.trim()) : [],
  };
};

/** The template with the JSON inside it. The only escape needed is the one that would end the script. */
export const renderDashboard = (json: string): string =>
  DASHBOARD_TEMPLATE.replace(DATA_PLACEHOLDER, () => json.replace(/<\//g, '<\\/'));

const openInBrowser = (path: string): void => {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', path]]
      : process.platform === 'darwin'
        ? ['open', [path]]
        : ['xdg-open', [path]];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // A browser that will not open is not a reason to fail: the path is printed anyway.
  }
};

export const dashboard = async (context: Context, args: ParsedArgs): Promise<string> => {
  const body = await dashboardPayload(context, args);

  if (context.json) return emitJson(context, body);

  const json = canonicalJson(payload(context, body));
  const html = renderDashboard(json);

  const outFlag = flagString(args.flags, 'out');
  if (outFlag === '-') return html;

  const defaultOut = context.logDir ? join(defaultOutDir(context.logDir), 'dashboard.html') : join(process.cwd(), 'dashboard.html');
  const outPath = outFlag ? (isAbsolute(outFlag) ? outFlag : resolve(process.cwd(), outFlag)) : defaultOut;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');

  if (!flagBool(args.flags, 'no-open')) openInBrowser(outPath);

  const lines = [`Written to ${outPath}`];
  const { coverage } = body;
  if (coverage.turns === 0) {
    lines.push('No turns were found, so the page says so rather than showing noughts.');
  } else {
    lines.push(
      `${coverage.turns} turns across ${coverage.sessions} ${coverage.sessions === 1 ? 'session' : 'sessions'}, ${coverage.from?.slice(0, 10)} to ${coverage.to?.slice(0, 10)}.`,
    );
    if (coverage.fromLogOnly > 0) {
      lines.push(
        paint(context, 'dim', `  ${coverage.fromLogOnly} of those are known only from the log; their transcripts have gone.`),
      );
    }
  }
  if (!body.withProjects) {
    lines.push(paint(context, 'dim', '  Projects and branches are left out. Add --with-projects to include them.'));
  }
  if (coverage.logWarn) {
    lines.push(
      paint(context, 'yellow', `  The log has grown to ${coverage.logMb} MB. Run "betteruseofai prune --before <date>" to trim it.`),
    );
  }
  return lines.join('\n');
};

/** Drops turns before a date from the log and compacts what remains. */
export const prune = async (context: Context, args: ParsedArgs): Promise<string> => {
  if (!context.logDir) {
    throw new Error('There is no log for this run to prune. Without --dir the log is on, or pass --log <path>.');
  }
  const beforeFlag = flagString(args.flags, 'before');
  if (!beforeFlag) {
    throw new Error('prune needs --before, for example --before 365d or --before 2026-01-01.');
  }
  const before = resolveSince(beforeFlag, context.now) ?? beforeFlag;
  if (Number.isNaN(new Date(before).getTime())) {
    throw new Error(`--before is not a date I can read: ${beforeFlag}`);
  }
  const dryRun = flagBool(args.flags, 'dry-run');
  const result = pruneLog(context.logDir, before, dryRun);

  if (context.json) {
    return emitJson(context, {
      command: 'prune',
      before,
      dryRun,
      removed: result.removed,
      duplicates: result.duplicates,
      kept: result.kept,
      filesBefore: result.filesBefore,
      filesAfter: result.filesAfter,
      bytesBefore: result.bytesBefore,
      bytesAfter: result.bytesAfter,
    });
  }

  const kb = (bytes: number): string => `${Math.round(bytes / 1024)} kB`;
  const verb = dryRun ? 'Would remove' : 'Removed';
  const lines = [
    `${verb} ${result.removed} ${result.removed === 1 ? 'turn' : 'turns'} before ${before.slice(0, 10)} and ${dryRun ? 'would compact' : 'compacted'} ${result.duplicates} superseded ${result.duplicates === 1 ? 'line' : 'lines'}.`,
    `${result.kept} ${result.kept === 1 ? 'turn remains' : 'turns remain'} in ${result.filesAfter} ${result.filesAfter === 1 ? 'file' : 'files'}, ${kb(result.bytesAfter)}, was ${kb(result.bytesBefore)}.`,
  ];
  if (dryRun) lines.push(paint(context, 'dim', '  Nothing was written. Run again without --dry-run to do it.'));
  return lines.join('\n');
};
