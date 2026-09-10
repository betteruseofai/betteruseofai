import { aggregate, equivalents, explainFlags, formatRange, getModel } from '@betteruseofai/core';

import type { ParsedArgs } from '../args.js';
import type { Context } from '../context.js';
import { loadEvents } from '../context.js';
import { caveats, emitJson, paint, rangeOut, readout, short, table } from '../output.js';

/** Every session, newest last, with what each one cost. */
export const sessions = async (context: Context, args: ParsedArgs): Promise<string> => {
  const { pairs } = await loadEvents(context, args);
  const buckets = aggregate(pairs, 'session').sort((a, b) => (a.from < b.from ? -1 : 1));

  if (context.json) {
    return emitJson(context, {
      command: 'sessions',
      sessions: buckets.map((one) => ({
        id: one.key,
        from: one.from,
        to: one.to,
        turns: one.count,
        energyWh: rangeOut(one.energyWh),
        waterMl: rangeOut(one.waterMl),
        carbonG: rangeOut(one.carbonG),
        surfaces: one.bySurface,
        models: one.byModel,
        unknownModelCount: one.unknownModelCount,
        flags: one.flags,
      })),
    });
  }

  if (buckets.length === 0) return 'No sessions found in that window.';

  return table(
    context,
    ['session', 'started', 'turns', 'energy', 'water', 'carbon'],
    buckets.map((one) => [
      one.key.length > 20 ? `${one.key.slice(0, 19)}…` : one.key,
      one.from.slice(0, 16).replace('T', ' '),
      String(one.count),
      short(one.energyWh, 'Wh'),
      short(one.waterMl, 'mL'),
      short(one.carbonG, 'g'),
    ]),
    ['left', 'left', 'right', 'right', 'right', 'right'],
  );
};

/**
 * The report for one session.
 *
 * This is the thing worth reading after a long coding session: what it cost,
 * which model did most of it, and which turns were the heavy ones.
 */
export const session = async (context: Context, args: ParsedArgs): Promise<string> => {
  const wanted = args.positional[0];
  if (!wanted) throw new Error('Which session? Run "betteruseofai sessions" to see the list.');

  const { pairs } = await loadEvents(context, args);
  const mine = pairs.filter(
    (pair) => pair.event.sessionId === wanted || pair.event.sessionId?.startsWith(wanted),
  );
  if (mine.length === 0) throw new Error(`No session here matches "${wanted}".`);

  const [totals] = aggregate(mine, 'all');
  const byModel = aggregate(mine, 'model');
  if (!totals) throw new Error(`No session here matches "${wanted}".`);

  const heaviest = [...mine]
    .filter((pair) => pair.estimate.energyWh !== null)
    .sort((a, b) => (b.estimate.energyWh?.central ?? 0) - (a.estimate.energyWh?.central ?? 0))
    .slice(0, 5);

  if (context.json) {
    return emitJson(context, {
      command: 'session',
      session: {
        id: mine[0]?.event.sessionId ?? wanted,
        from: totals.from,
        to: totals.to,
        turns: totals.count,
        energyWh: rangeOut(totals.energyWh),
        waterMl: rangeOut(totals.waterMl),
        carbonG: rangeOut(totals.carbonG),
        unknownModelCount: totals.unknownModelCount,
        noBenchmarkCount: totals.noBenchmarkCount,
        flags: totals.flags,
        byModel: byModel.map((one) => ({
          model: one.key,
          turns: one.count,
          energyWh: rangeOut(one.energyWh),
        })),
        heaviestTurns: heaviest.map((pair) => ({
          id: pair.event.id,
          timestamp: pair.event.timestamp,
          model: pair.estimate.modelId,
          energyWh: rangeOut(pair.estimate.energyWh),
          inputTokens: pair.event.tokens.input ?? 0,
          outputTokens: pair.event.tokens.output ?? 0,
          cachedReadTokens: pair.event.tokens.cachedRead ?? 0,
          cachedWriteTokens: pair.event.tokens.cachedWrite ?? 0,
          thinkingTokens: pair.event.tokens.thinking,
        })),
      },
    });
  }

  const lines: string[] = [];
  lines.push(paint(context, 'bold', `Session ${mine[0]?.event.sessionId ?? wanted}`));
  lines.push(
    paint(
      context,
      'dim',
      `${totals.count} turns, ${totals.from.slice(0, 16).replace('T', ' ')} to ${totals.to.slice(11, 16)} UTC`,
    ),
  );
  lines.push('');
  lines.push(...readout(context, totals));

  const found = equivalents(totals.energyWh?.central ?? null, 'energy', context.dataset, 2);
  if (found.length > 0) {
    lines.push(
      paint(
        context,
        'dim',
        `          about ${found.map((one) => `${one.count.toFixed(1)} ${one.label}`).join(', or ')}`,
      ),
    );
  }

  lines.push('');
  lines.push(
    table(
      context,
      ['model', 'turns', 'energy', 'share'],
      byModel.map((one) => {
        const share = (one.energyWh?.central ?? 0) / (totals.energyWh?.central || 1);
        return [
          getModel(one.key, context.dataset)?.displayName ?? one.key,
          String(one.count),
          short(one.energyWh, 'Wh'),
          one.energyWh === null ? 'unknown' : `${Math.round(share * 100)}%`,
        ];
      }),
      ['left', 'right', 'right', 'right'],
    ),
  );

  if (heaviest.length > 0) {
    lines.push('');
    lines.push(paint(context, 'dim', 'HEAVIEST TURNS'));
    lines.push(
      table(
        context,
        // Cache writes are charged at the full input rate and routinely dwarf
        // everything else, so the column has to be here. Without it a turn with
        // 134 output tokens and a 351,000 token cache write looks inexplicable.
        ['at', 'model', 'in', 'cache read', 'cache write', 'out', 'thinking', 'energy'],
        heaviest.map((pair) => [
          pair.event.timestamp.slice(11, 19),
          pair.estimate.modelId ?? 'unknown',
          String(pair.event.tokens.input ?? 0),
          String(pair.event.tokens.cachedRead ?? 0),
          String(pair.event.tokens.cachedWrite ?? 0),
          String(pair.event.tokens.output ?? 0),
          pair.event.tokens.thinking === null
            ? 'not said'
            : String(pair.event.tokens.thinking ?? 0),
          formatRange(pair.estimate.energyWh, {
            unit: 'Wh',
            bounds: false,
            flags: pair.estimate.basis.flags,
            ascii: context.ascii,
          }),
        ]),
        ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'],
      ),
    );
  }

  const notes = caveats(context, totals);
  if (notes.length > 0) {
    lines.push('');
    lines.push(...notes);
  }

  const why = explainFlags(totals.flags);
  if (why.length > 0) {
    lines.push('');
    lines.push(paint(context, 'dim', 'WHY THE FIGURES ARE UNCERTAIN'));
    for (const line of why) lines.push(`  ${line}`);
  }

  return lines.join('\n');
};
