import { canonicalNumber, displayNumber, formatRange, scaleUnit } from '@betteruseofai/core';
import type { Aggregate, EstimateFlag, Range } from '@betteruseofai/core';

import tokens from '@betteruseofai/tokens/tokens.json' with { type: 'json' };

import { canonicalJson, SCHEMA_VERSION } from './canonical.js';
import type { Context } from './context.js';

/**
 * Terminal output.
 *
 * Plain text is for a person, so it uses the same wording rules as the website.
 * JSON is for a machine and for the parity check, so it goes through the
 * canonical writer and nothing else.
 */

/*
 * The escape codes come from the shared tokens, so the terminal reads from the
 * same file as the site and the extension. tokens.json says why the two
 * colours are green and yellow and never red: a caveat and a figure have to
 * stay apart for somebody who cannot tell red from green.
 */
const CODES = tokens.terminal.codes;
const ANSI = Object.fromEntries(
  Object.entries(CODES).map(([name, code]) => [name, `\x1b[${code}m`]),
) as Record<keyof typeof CODES, string>;

export const paint = (context: Context, colour: keyof typeof CODES, text: string): string =>
  context.colour ? `${ANSI[colour]}${text}${ANSI.reset}` : text;

/**
 * A ten-cell block meter for a share. The one place the terminal draws a bar,
 * because a share of a whole is the one quantity a bar cannot misrepresent:
 * there is no hidden floor and no range to flatten.
 */
export const meter = (share: number, ascii: boolean): string => {
  const cells = Math.max(0, Math.min(10, Math.floor(share * 10 + 0.5)));
  const glyphs = tokens.terminal.meter;
  const on = ascii ? glyphs.asciiFilled : glyphs.filled;
  const off = ascii ? glyphs.asciiEmpty : glyphs.empty;
  return on.repeat(cells) + off.repeat(10 - cells);
};

/** Small numbers as words in prose, the way the style guide asks. */
export const words = (value: number): string => {
  const table = [
    'nought', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
    'nineteen', 'twenty',
  ];
  return table[value] ?? String(value);
};

/**
 * The note that follows a stale comparison, with its age worked out from the
 * source date rather than typed in. "Seventeen years old" was a string once,
 * and it would have been wrong from the first of January.
 */
export const staleNote = (source: { date?: string } | undefined, now: Date): string => {
  const year = Number.parseInt((source?.date ?? '').slice(0, 4), 10);
  if (!Number.isFinite(year)) return ', from a figure marked stale';
  const age = now.getUTCFullYear() - year;
  return `, from a figure now ${words(age)} years old`;
};

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

export const short = (range: Range | null, unit: string): string => {
  if (range === null) return 'unknown';
  const scaled = scaleUnit(range.central, unit);
  return `${displayNumber(scaled.value)} ${scaled.unit}`;
};
