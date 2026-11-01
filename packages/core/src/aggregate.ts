import { add } from './range.js';
import type { Aggregate, AggregateBucket, Estimate, EstimateFlag, Range, UsageEvent } from './types.js';

/**
 * Rolls estimates up by day, week, model, surface, session, hosting or the lot.
 *
 * Two rules matter here. Events we could not put a number on are counted in
 * their own field and never folded into the totals as zero, so a week full of
 * unrecognised models does not read as a light week. And a bucket where nothing
 * could be estimated has null totals rather than zeroed ones.
 */

const isoDay = (timestamp: string): string => timestamp.slice(0, 10);

/** Monday of the week containing this timestamp, as an ISO date. */
const isoWeekStart = (timestamp: string): string => {
  const date = new Date(`${isoDay(timestamp)}T00:00:00Z`);
  const weekday = date.getUTCDay();
  const shift = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
};

export interface AggregateInput {
  event: UsageEvent;
  estimate: Estimate;
}

const keyFor = (bucket: AggregateBucket, input: AggregateInput): string => {
  const { event, estimate } = input;
  switch (bucket) {
    case 'day':
      return isoDay(event.timestamp);
    case 'week':
      return isoWeekStart(event.timestamp);
    case 'model':
      return estimate.modelId ?? 'unknown';
    case 'surface':
      return event.surface;
    case 'session':
      return event.sessionId ?? event.conversationId ?? 'no-session';
    case 'hosting':
      return event.hosting;
    case 'all':
      return 'all';
  }
};

const bump = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/** A total whose turns are at least this far apart has seen the grid's hours average out. */
export const GRID_HOURS_AVERAGE_MS = 24 * 60 * 60 * 1000;

/**
 * One turn's carbon at the grid's average intensity for the year, keeping the
 * whole of its energy range.
 *
 * A turn's carbon range carries the hourly spread of the grid, the 10th to
 * the 90th percentile of the year's hours. That is right for one turn, which
 * happens in one hour. Added up over a total spread across days, it says
 * every turn ran in the dirtiest hour (audit E12, decided 2026-10-30). The
 * central intensity is the carbon over the energy at their centrals; a turn
 * with no energy figure published its carbon directly and keeps its range.
 */
const atYearAverage = (estimate: Estimate): Range | null => {
  const { energyWh, carbonG } = estimate;
  if (!carbonG) return null;
  if (!energyWh || energyWh.central <= 0) return carbonG;
  const intensity = carbonG.central / energyWh.central;
  return { low: energyWh.low * intensity, central: carbonG.central, high: energyWh.high * intensity };
};

export const aggregate = (inputs: AggregateInput[], bucket: AggregateBucket = 'all'): Aggregate[] => {
  const buckets = new Map<string, AggregateInput[]>();
  for (const input of inputs) {
    const key = keyFor(bucket, input);
    const existing = buckets.get(key);
    if (existing) existing.push(input);
    else buckets.set(key, [input]);
  }

  const result: Aggregate[] = [];

  for (const [key, group] of buckets) {
    const timestamps = group.map((item) => item.event.timestamp).sort();
    let energyWh: Range | null = null;
    let waterMl: Range | null = null;
    let carbonG: Range | null = null;
    let carbonAveraged: Range | null = null;
    let unknownModelCount = 0;
    let noBenchmarkCount = 0;
    const bySurface: Record<string, number> = {};
    const byHosting: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const flags = new Set<EstimateFlag>();

    for (const { event, estimate } of group) {
      bump(bySurface, event.surface);
      bump(byHosting, event.hosting);
      bump(byModel, estimate.modelId ?? 'unknown');
      for (const flag of estimate.basis.flags) flags.add(flag);

      if (estimate.basis.flags.includes('model-unknown')) unknownModelCount += 1;
      if (estimate.basis.flags.includes('no-benchmark')) noBenchmarkCount += 1;

      if (estimate.energyWh) energyWh = energyWh ? add(energyWh, estimate.energyWh) : estimate.energyWh;
      if (estimate.waterMl) waterMl = waterMl ? add(waterMl, estimate.waterMl) : estimate.waterMl;
      if (estimate.carbonG) carbonG = carbonG ? add(carbonG, estimate.carbonG) : estimate.carbonG;
      const averaged = atYearAverage(estimate);
      if (averaged) carbonAveraged = carbonAveraged ? add(carbonAveraged, averaged) : averaged;
    }

    const from = timestamps[0] ?? '';
    const to = timestamps[timestamps.length - 1] ?? '';
    // Turns within a day can share an hour, and then they share its grid, so
    // the hourly spread stays. Across days the hours average out.
    const spansDays = from !== '' && Date.parse(to) - Date.parse(from) >= GRID_HOURS_AVERAGE_MS;

    result.push({
      key,
      bucket,
      from,
      to,
      count: group.length,
      energyWh,
      waterMl,
      carbonG: spansDays ? carbonAveraged : carbonG,
      bySurface,
      byHosting,
      byModel,
      unknownModelCount,
      noBenchmarkCount,
      flags: [...flags].sort(),
    });
  }

  return result.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};
