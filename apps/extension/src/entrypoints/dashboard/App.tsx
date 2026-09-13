import { displayNumber, equivalents, scaleUnit } from '@betteruseofai/core';
import type { Aggregate, Dataset, Range } from '@betteruseofai/core';
import { useEffect, useState } from 'preact/hooks';

import { MetaStrip, Readout } from '../../ui/Readout.js';
import type { Settings } from '../../lib/storage.js';
import { browser } from 'wxt/browser';

/**
 * The dashboard: the same figures with more room around them.
 *
 * A bar per day rather than a chart library. The shape of a week is the useful
 * thing, and drawing it with three divs keeps a hundred kilobytes of chart code
 * out of an extension whose whole argument is that it is small and reads
 * nothing.
 */

interface Summary {
  settings: Settings;
  datasetVersion: string;
  total: Aggregate | null;
  byDay: Aggregate[];
  byModel: Aggregate[];
  bySurface: Aggregate[];
  count: number;
}

export const App = ({ dataset }: { dataset: Dataset }) => {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const load = (): void => {
      void browser.runtime
        .sendMessage({ type: 'summary:get' })
        .then((value) => setSummary(value as Summary))
        .catch(() => undefined);
    };
    load();
    const onChange = (message: { type?: string }): void => {
      if (message?.type === 'events:changed') load();
    };
    browser.runtime.onMessage.addListener(onChange);
    return () => browser.runtime.onMessage.removeListener(onChange);
  }, []);

  /*
   * Still loading is not the same as empty. Showing "nothing to show yet"
   * while the answer is on its way tells the reader something untrue, and it
   * is the kind of untrue thing this project is supposed to be careful about.
   */
  if (summary === null) {
    return (
      <main class="buai-dash">
        <p class="buai-readout__label">Reading what is stored</p>
      </main>
    );
  }

  if (!summary.total || summary.total.count === 0) {
    return (
      <main class="buai-dash">
        <h1>Nothing to show yet</h1>
        <div class="buai-standby">
          <span class="buai-standby__code">empty</span>
          Send a message on one of the sites this extension reads and it will appear here.
        </div>
      </main>
    );
  }

  const total = summary.total;
  const peak = Math.max(...summary.byDay.map((one) => one.energyWh?.central ?? 0), 1);

  return (
    <main class="buai-dash">
      <h1>What this browser has cost</h1>

      <div class="buai-dash__readouts">
        <Readout label="Energy" value={total.energyWh} unit="Wh" flags={total.flags} />
        <Readout label="Water" value={total.waterMl} unit="mL" flags={total.flags} />
        <Readout label="Carbon" value={total.carbonG} unit="g" flags={total.flags} />
      </div>

      <section>
        <h2>Every day</h2>
        <div class="buai-dash__days">
          {summary.byDay.map((day) => (
            <div class="buai-dash__day" key={day.key}>
              <div class="buai-dash__bar-track">
                <div
                  class="buai-dash__bar"
                  style={{ height: `${((day.energyWh?.central ?? 0) / peak) * 100}%` }}
                />
              </div>
              <span class="buai-dash__daylabel">{day.key.slice(5)}</span>
              <span class="buai-dash__dayvalue">{short(day.energyWh, 'Wh')}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Which models</h2>
        <div class="buai-scroll-x">
          <table class="buai-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col" style="text-align:right">Turns</th>
                <th scope="col" style="text-align:right">Energy</th>
                <th scope="col" style="text-align:right">Water</th>
                <th scope="col" style="text-align:right">Carbon</th>
              </tr>
            </thead>
            <tbody>
              {summary.byModel.map((one) => (
                <tr key={one.key}>
                  <td>{one.key === 'unknown' ? 'we do not recognise this one' : one.key}</td>
                  <td class="buai-num">{one.count}</td>
                  <td class="buai-num">{short(one.energyWh, 'Wh')}</td>
                  <td class="buai-num">{short(one.waterMl, 'mL')}</td>
                  <td class="buai-num">{short(one.carbonG, 'g')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Put another way</h2>
        <ul class="buai-dash__equivalents">
          {(['energy', 'water', 'carbon'] as const).flatMap((quantity) => {
            const value =
              quantity === 'energy'
                ? total.energyWh?.central
                : quantity === 'water'
                  ? total.waterMl?.central
                  : total.carbonG?.central;
            return equivalents(value ?? null, quantity, dataset, 2).map((one) => (
              <li key={one.id}>
                {one.count.toFixed(1)} {one.label}
                {one.stale ? ' (from a figure now seventeen years old)' : ''}
              </li>
            ));
          })}
        </ul>
      </section>

      <MetaStrip
        items={[
          `${total.count} turns`,
          `${total.from.slice(0, 10)} to ${total.to.slice(0, 10)}`,
          `dataset ${summary.datasetVersion}`,
          'telemetry: none',
        ]}
      />
    </main>
  );
};

const short = (value: Range | null | undefined, unit: string): string => {
  // Undefined as well as null. A row written by an older version can be
  // missing the field entirely, and reading through it crashed the page.
  if (value === null || value === undefined) return 'unknown';
  const scaled = scaleUnit(value.central, unit);
  return `${displayNumber(scaled.value)} ${scaled.unit}`;
};
