import { canonicalNumber, displayNumber, formatRange } from '@betteruseofai/core';
import type { Aggregate, EstimateFlag, Range } from '@betteruseofai/core';

import { canonicalJson, SCHEMA_VERSION } from './canonical.js';
import type { Context } from './context.js';

/**
 * Terminal output.
 *
 * Plain text is for a person, so it uses the same wording rules as the website.
 * JSON is for a machine and for the parity check, so it goes through the
 * canonical writer and nothing else.
 */

const ANSI = {
  dim: '[2m',
  bold: '[1m',
  green: '[32m',
  yellow: '[33m',
  reset: '[0m',
};

export const paint = (context: Context, colour: keyof typeof ANSI, text: string): string =>
  context.colour ? `${ANSI[colour]}${text}${ANSI.reset}` : text;

/** A range as a plain object of canonical strings, for the JSON payload. */
export const rangeOut = (range: Range | null): Record<string, string> | null =>
  range === null
    ? null
    : {
        low: canonicalNumber(range.low),
        central: canonicalNumber(range.central),
        high: canonicalNumber(range.high),
      };

export interface Payload {
  header: {
    schemaVersion: number;
    datasetVersion: string;
    datasetSha256: string;
    generatedWith: string;
    generatedAt: string;
  };
  [key: string]: unknown;
}

export const payload = (context: Context, body: Record<string, unknown>): Payload => ({
  header: {
    schemaVersion: SCHEMA_VERSION,
    datasetVersion: context.dataset.version,
    datasetSha256: context.dataset.sha256,
    generatedWith: 'betteruseofai typescript',
    generatedAt: context.now.toISOString(),
  },
  ...body,
});

export const emitJson = (context: Context, body: Record<string, unknown>): string =>
  canonicalJson(payload(context, body));

/** A fixed width table with a hairline under the header, matching the site. */
export const table = (
  context: Context,
  headers: string[],
  rows: string[][],
  align: Array<'left' | 'right'> = [],
): string => {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const pad = (text: string, column: number): string =>
    align[column] === 'right'
      ? text.padStart(widths[column] ?? 0)
      : text.padEnd(widths[column] ?? 0);

  const lines = [
    paint(context, 'dim', headers.map((header, column) => pad(header.toUpperCase(), column)).join('  ')),
    paint(context, 'dim', widths.map((width) => '-'.repeat(width)).join('  ')),
    ...rows.map((row) => row.map((cell, column) => pad(cell, column)).join('  ')),
  ];
  return lines.join('\n');
};

/** The three headline figures for one bucket, as a person reads them. */
export const readout = (context: Context, totals: Aggregate): string[] => {
  const options = { flags: totals.flags, ascii: context.ascii };
  return [
    `  energy  ${formatRange(totals.energyWh, { ...options, unit: 'Wh' })}`,
    `  water   ${formatRange(totals.waterMl, { ...options, unit: 'mL' })}`,
    `  carbon  ${formatRange(totals.carbonG, { ...options, unit: 'g' })}`,
  ];
};

/**
 * The line that says what we could not price.
 *
 * It is printed whenever anything was left out, because a total that silently
 * omits a third of the turns is worse than no total.
 */
export const caveats = (context: Context, totals: Aggregate): string[] => {
  const lines: string[] = [];
  if (totals.unknownModelCount > 0) {
    lines.push(
      paint(
        context,
        'yellow',
        `  ${totals.unknownModelCount} of ${totals.count} turns used a model we do not recognise. They are not in the figures above.`,
      ),
    );
  }
  if (totals.noBenchmarkCount > 0) {
    lines.push(
      paint(
        context,
        'yellow',
        `  ${totals.noBenchmarkCount} turns used a model nobody has measured. They are not in the figures above.`,
      ),
    );
  }
  if (totals.flags.includes('thinking-unknown')) {
    lines.push('  Some turns hid their reasoning tokens, so the figures are a lower bound.');
  }
  if (totals.flags.includes('proxy-row')) {
    lines.push('  Some models have never been measured, so their share is scaled from one that has.');
  }
  if (totals.flags.includes('region-default')) {
    lines.push('  No region given, so this uses the world average grid. Pass --region to change it.');
  }
  return lines;
};

export const flagList = (flags: EstimateFlag[]): string => (flags.length === 0 ? '' : flags.join(' '));

export const short = (range: Range | null, unit: string): string =>
  range === null ? 'unknown' : `${displayNumber(range.central)} ${unit}`;
