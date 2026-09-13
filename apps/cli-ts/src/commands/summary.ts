import { aggregate, equivalents } from '@betteruseofai/core';
import type { AggregateBucket } from '@betteruseofai/core';

import { flagString } from '../args.js';
import type { ParsedArgs } from '../args.js';
import type { Context } from '../context.js';
import { loadEvents } from '../context.js';
import { caveats, emitJson, paint, rangeOut, readout, short, staleNote, table } from '../output.js';

const BUCKETS: AggregateBucket[] = ['day', 'week', 'model', 'surface', 'session', 'hosting', 'all'];

export const summary = async (context: Context, args: ParsedArgs): Promise<string> => {
  const bucketFlag = flagString(args.flags, 'by');
  if (bucketFlag && !BUCKETS.includes(bucketFlag as AggregateBucket)) {
    throw new Error(`--by must be one of: ${BUCKETS.join(', ')}`);
  }
  const bucket = (bucketFlag as AggregateBucket) ?? 'day';

  const { pairs } = await loadEvents(context, args);
  const buckets = aggregate(pairs, bucket);
  const [totals] = aggregate(pairs, 'all');

  if (context.json) {
    return emitJson(context, {
      command: 'summary',
      by: bucket,
      window: { since: context.since ?? null, until: context.until ?? null },
      settings: {
        region: context.regionCode ?? context.dataset.defaultRegion,
        waterScope: context.waterScope,
        carbonBasis: context.carbonBasis,
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
          }
        : null,
      buckets: buckets.map((one) => ({
        key: one.key,
        from: one.from,
        to: one.to,
        count: one.count,
        energyWh: rangeOut(one.energyWh),
        waterMl: rangeOut(one.waterMl),
        carbonG: rangeOut(one.carbonG),
        byModel: one.byModel,
        bySurface: one.bySurface,
        unknownModelCount: one.unknownModelCount,
        noBenchmarkCount: one.noBenchmarkCount,
        flags: one.flags,
      })),
    });
  }

  if (!totals || totals.count === 0) {
    return 'No sessions found in that window. Try a longer one with --since, or check --source.';
  }

  const lines: string[] = [];
  const window = context.since ? `since ${context.since.slice(0, 10)}` : 'all time';
  lines.push(paint(context, 'bold', `${totals.count} turns, ${window}`));
  lines.push('');
  lines.push(...readout(context, totals));

  /*
   * Each comparison names its quantity. Without that, "2.4 smartphone charges"
   * for energy and "1.6 smartphones charged" for carbon sat in one list and
   * read as the tool contradicting itself. The calculator groups them under
   * headings for the same reason.
   */
  for (const [quantity, value] of [
    ['energy', totals.energyWh?.central],
    ['water', totals.waterMl?.central],
    ['carbon', totals.carbonG?.central],
  ] as const) {
    const found = equivalents(value ?? null, quantity, context.dataset, 1)[0];
    if (found) {
      lines.push(
        paint(
          context,
          'dim',
          `          ${quantity}: about ${found.count.toFixed(1)} ${found.label}${found.stale ? staleNote(found.source, context.now) : ''}`,
        ),
      );
    }
  }

  lines.push('');
  lines.push(
    table(
      context,
      [bucket, 'turns', 'energy', 'water', 'carbon'],
      buckets.map((one) => [
        one.key,
        String(one.count),
        short(one.energyWh, 'Wh'),
        short(one.waterMl, 'mL'),
        short(one.carbonG, 'g'),
      ]),
      ['left', 'right', 'right', 'right', 'right'],
    ),
  );

  const notes = caveats(context, totals);
  if (notes.length > 0) {
    lines.push('');
    lines.push(...notes);
  }

  lines.push('');
  lines.push(
    paint(
      context,
      'dim',
      `  dataset ${context.dataset.version} · region ${context.regionCode ?? context.dataset.defaultRegion} · water ${context.waterScope} · estimate, not a measurement`,
    ),
  );

  return lines.join('\n');
};
