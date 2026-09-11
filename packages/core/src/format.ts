import type { EstimateFlag, Range } from './types.js';

/**
 * Number formatting, and the rounding rule the Python command line tool has to
 * reproduce byte for byte.
 *
 * The rule is deliberately dull: round to six significant digits using the
 * language's own correctly rounded decimal conversion, then drop trailing
 * zeros. In TypeScript that is Number.prototype.toPrecision; in Python it is
 * the %.6g format. Both round the exact binary value, so they agree.
 */

export const SIGNIFICANT_DIGITS = 6;

/** Rounds to six significant digits and returns a number. */
export const roundSignificant = (value: number, digits: number = SIGNIFICANT_DIGITS): number => {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;
  return Number.parseFloat(value.toPrecision(digits));
};

/**
 * The canonical decimal string for a number. This is what goes into exported
 * JSON, and it is the thing the parity test compares byte for byte.
 *
 * The Python implementation has to follow all four of these rules, because the
 * two languages do not agree on their own:
 *
 *   1. Round to six significant digits with the language's correctly rounded
 *      decimal conversion: toPrecision here, %.6g in Python.
 *   2. Print the shortest form that round trips. Python needs repr for that.
 *   3. Drop a trailing ".0", which Python adds to every float and JavaScript
 *      does not.
 *   4. Strip leading zeros from the exponent, keeping its sign. Python writes
 *      1e-09 where JavaScript writes 1e-9.
 */
export const canonicalNumber = (value: number, digits: number = SIGNIFICANT_DIGITS): string => {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
  if (value === 0) return '0';
  const rounded = roundSignificant(value, digits);
  const text = String(rounded);
  return text.replace(/\.0$/, '').replace(/e([+-])0+(\d)/, 'e$1$2');
};

/** Human display: a small number keeps more decimals than a large one. */
export const displayNumber = (value: number): string => {
  const magnitude = Math.abs(value);
  if (magnitude === 0) return '0';
  if (magnitude >= 100) return String(Math.round(value));
  if (magnitude >= 10) return value.toFixed(1);
  if (magnitude >= 1) return value.toFixed(2);
  if (magnitude >= 0.01) return value.toFixed(3);
  return value.toPrecision(2);
};

/**
 * Steps a figure up to a larger unit once it stops being readable.
 *
 * An agent session reaches thousands of watt hours and tens of thousands of
 * millilitres, and "7111 Wh" is a number nobody pictures. The thresholds are
 * plain factors of a thousand, so the reader can always convert back in their
 * head.
 */
const SCALES: Record<string, Array<{ at: number; unit: string; divide: number }>> = {
  Wh: [{ at: 1000, unit: 'kWh', divide: 1000 }],
  mL: [{ at: 1000, unit: 'L', divide: 1000 }],
  g: [{ at: 1000, unit: 'kg', divide: 1000 }],
};

export const scaleUnit = (value: number, unit: string): { value: number; unit: string } => {
  for (const step of SCALES[unit] ?? []) {
    if (Math.abs(value) >= step.at) return { value: value / step.divide, unit: step.unit };
  }
  return { value, unit };
};

export interface FormatRangeOptions {
  unit?: string;
  /** Flags from the estimate, so a lower bound renders as one. */
  flags?: EstimateFlag[];
  /** Set false to leave off the bracketed bounds. */
  bounds?: boolean;
  /** Use plain ASCII, for a status line that has to survive any terminal. */
  ascii?: boolean;
}

/**
 * Renders a range.
 *
 * A range whose thinking tokens were never disclosed is a lower bound and is
 * marked as one, because the alternative is a number that reads as complete
 * when it is not.
 */
export const formatRange = (
  range: Range | null | undefined,
  options: FormatRangeOptions = {},
): string => {
  const { unit, flags = [], bounds = true, ascii = false } = options;
  // Both shapes of absence. Null is a figure we could not work out; undefined
  // is a field that is not there at all, which stored data from an older
  // version can produce. A crash on the second is how this was found.
  if (range === null || range === undefined) return 'unknown';

  const lowerBound = flags.includes('thinking-unknown');
  const estimated = flags.includes('tokens-estimated') || flags.includes('derived-rate');
  const prefix = lowerBound ? (ascii ? '>= ' : '≥ ') : estimated ? '~' : '';

  // The whole range is shown in one unit, chosen by the central value, so the
  // three numbers can be compared without doing arithmetic.
  const scaled = unit ? scaleUnit(range.central, unit) : { value: range.central, unit: '' };
  const divisor = unit && scaled.unit !== unit ? range.central / scaled.value : 1;
  const suffix = scaled.unit ? ` ${scaled.unit}` : '';

  const central = `${prefix}${displayNumber(scaled.value)}${suffix}`;
  if (!bounds) return central;
  const low = displayNumber(range.low / divisor);
  const high = displayNumber(range.high / divisor);
  return `${central} [ ${low} to ${high} ]`;
};

/** One line of plain English saying why a figure is uncertain. */
export const explainFlags = (flags: EstimateFlag[]): string[] => {
  const lines: string[] = [];
  for (const flag of flags) {
    switch (flag) {
      case 'model-unknown':
        lines.push('We do not recognise this model, so there is no figure to show.');
        break;
      case 'no-benchmark':
        lines.push('We know this model but nobody has published a measurement for it.');
        break;
      case 'tokens-estimated':
        lines.push('Token counts come from our own tokenizer, not from the provider.');
        break;
      case 'thinking-unknown':
        lines.push(
          'This model thinks before it answers and did not say how much, so the figure is a lower bound.',
        );
        break;
      case 'proxy-row':
        lines.push('Scaled from a different model, because nobody has measured this one.');
        break;
      case 'region-default':
        lines.push('No region was given, so this uses the world average grid.');
        break;
      case 'input-partial':
        lines.push('The app hides its system prompt, so the input count is a lower bound.');
        break;
      case 'derived-rate':
        lines.push('The rate was worked out from a single published figure for one exchange.');
        break;
      case 'assumed-token-counts':
        lines.push('The source did not say how long its reference exchange was, so we assumed it.');
        break;
      case 'parametric-rate':
        lines.push('The rate comes from a formula rather than a measurement.');
        break;
      case 'no-energy-figure':
        lines.push('The source published water and carbon but no energy, so energy is unknown.');
        break;
      case 'scaled-direct-figure':
        lines.push('Water and carbon were published per exchange and scaled to this one.');
        break;
      case 'local-row-missing':
        lines.push('No measurement exists for this model on your own machine, so a hosted row was used.');
        break;
    }
  }
  return lines;
};
