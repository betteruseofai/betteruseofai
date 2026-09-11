import { displayNumber, formatRange, scaleUnit } from '@betteruseofai/core';
import type { EstimateFlag, Range } from '@betteruseofai/core';

/**
 * The signature components, re-implemented against the same class names the
 * website uses.
 *
 * They are written out again rather than shared as a component library,
 * because the site is Astro and this is Preact, and a shared library would
 * mean a framework in both. The class names are the contract: the CSS comes
 * from @betteruseofai/tokens and the two read as one system.
 */

export interface ReadoutProps {
  label: string;
  /** Both shapes of absence. Null is a figure we could not work out; undefined
   *  is a field that is not there at all, which stored data from an older
   *  version can produce. Neither is a zero. */
  value: Range | null | undefined;
  unit: string;
  flags?: EstimateFlag[];
}

export const Readout = ({ label, value, unit, flags = [] }: ReadoutProps) => {
  // A figure we do not have is a word, never a nought, and it gets no bar.
  /*
   * One element, always. These sit in a grid on the dashboard, and returning a
   * fragment made the figure and its bar two separate grid items that wrapped
   * independently, which scrambled the three readouts into six cells.
   */
  if (value === null || value === undefined) {
    return (
      <div class="buoa-readout-group">
        <div class="buoa-readout buoa-readout--unknown">
          <span class="buoa-readout__label">{label}</span>
          <span class="buoa-readout__figure">unknown</span>
          <span class="buoa-readout__bounds">nothing we can stand behind</span>
        </div>
      </div>
    );
  }

  const scaled = scaleUnit(value.central, unit);
  const divisor = scaled.unit === unit ? 1 : value.central / scaled.value;
  const lowerBound = flags.includes('thinking-unknown');

  return (
    <div class="buoa-readout-group">
      <div class="buoa-readout">
        <span class="buoa-readout__label">{label}</span>
        <span class="buoa-readout__figure">
          {lowerBound ? '≥ ' : ''}
          {displayNumber(scaled.value)}
          <span class="buoa-readout__unit">{scaled.unit}</span>
        </span>
        <span class="buoa-readout__bounds">
          [ {displayNumber(value.low / divisor)} to {displayNumber(value.high / divisor)} ]
        </span>
      </div>
      <RangeBar value={value} />
    </div>
  );
};

/**
 * The three-stop bar.
 *
 * Drawn on a log scale, because the high bound is routinely fifty times the
 * low one and a linear bar would put the central mark against the left edge
 * and tell nobody anything.
 */
export const RangeBar = ({ value }: { value: Range }) => {
  const position = (one: number): number => {
    const span = Math.log10(Math.max(value.high, 1e-9)) - Math.log10(Math.max(value.low, 1e-9));
    if (span <= 0) return 50;
    return ((Math.log10(Math.max(one, 1e-9)) - Math.log10(Math.max(value.low, 1e-9))) / span) * 100;
  };

  const style = {
    '--buoa-low': '0%',
    '--buoa-central': `${position(value.central).toFixed(1)}%`,
    '--buoa-high': '100%',
  } as unknown as Record<string, string>;

  return (
    <div class="buoa-rangebar" style={style} aria-hidden="true">
      <div class="buoa-rangebar__band" />
      <div class="buoa-rangebar__hazard" />
      <div class="buoa-rangebar__tick" />
    </div>
  );
};

export const MetaStrip = ({ items }: { items: string[] }) => (
  <div class="buoa-metastrip">
    {items.map((item) => (
      <span class="buoa-metastrip__item" key={item}>
        {item}
      </span>
    ))}
  </div>
);

export const Hazard = ({ label, children }: { label: string; children: preact.ComponentChildren }) => (
  <div class="buoa-hazard">
    <span class="buoa-hazard__label">{label}</span>
    {children}
  </div>
);

export const formatFor = (value: Range | null, unit: string, flags: EstimateFlag[]): string =>
  formatRange(value, { unit, flags });
