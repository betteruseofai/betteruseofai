import type { Range } from './types.js';

/** A range with all three bounds equal. */
export const exact = (value: number): Range => ({ low: value, central: value, high: value });

export const ZERO: Range = exact(0);

export const isRange = (value: unknown): value is Range =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Range).low === 'number' &&
  typeof (value as Range).central === 'number' &&
  typeof (value as Range).high === 'number';

export const add = (a: Range, b: Range): Range => ({
  low: a.low + b.low,
  central: a.central + b.central,
  high: a.high + b.high,
});

export const sum = (ranges: Range[]): Range => ranges.reduce(add, ZERO);

/**
 * Multiplies two ranges bound for bound.
 *
 * This treats the two as perfectly correlated, which widens faster than a proper
 * uncertainty propagation would. That is the direction we want to err in: an
 * over-wide range is honest, an over-narrow one is a false claim.
 */
export const mul = (a: Range, b: Range): Range => ({
  low: a.low * b.low,
  central: a.central * b.central,
  high: a.high * b.high,
});

export const scale = (a: Range, factor: number): Range => ({
  low: a.low * factor,
  central: a.central * factor,
  high: a.high * factor,
});

export const div = (a: Range, b: Range): Range => ({
  // The bounds cross over: dividing by the high bound gives the low result.
  low: b.high === 0 ? 0 : a.low / b.high,
  central: b.central === 0 ? 0 : a.central / b.central,
  high: b.low === 0 ? 0 : a.high / b.low,
});

/** Ensures low <= central <= high after arithmetic that could have crossed them. */
export const order = (r: Range): Range => {
  const [low, central, high] = [r.low, r.central, r.high].sort((a, b) => a - b) as [
    number,
    number,
    number,
  ];
  return { low, central, high };
};

export const clampNonNegative = (r: Range): Range => ({
  low: Math.max(0, r.low),
  central: Math.max(0, r.central),
  high: Math.max(0, r.high),
});
