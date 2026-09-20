import { displayNumber, equivalents, scaleUnit } from '@betteruseofai/core';
import type { Aggregate, Dataset, Range, Saving } from '@betteruseofai/core';
import { useEffect, useState } from 'preact/hooks';

import { MetaStrip, Readout, staleNote } from '../../ui/Readout.js';
import type { Settings } from '../../lib/storage.js';
import { browser } from 'wxt/browser';

/**
 * The dashboard: the same figures with more room around them.
 *
 * A bar per day rather than a chart library. The shape of a week is the useful
 * thing, and drawing it with three divs keeps a hundred kilobytes of chart code
 * out of an extension whose whole argument is that it is small and reads
 * nothing.
 *
 * And the one place a saving is shown, because this is the one surface that
 * holds a person's own turns. It is drawn as rings: one per day of recorded
 * use, each ring's growth the energy that day saved against the largest model
 * in its family. Tree rings, and a wafer map, at once. It does not move.
 */

interface Summary {
  settings: Settings;
  datasetVersion: string;
  total: Aggregate | null;
  byDay: Aggregate[];
  byModel: Aggregate[];
  bySurface: Aggregate[];
  saving: Saving | null;
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

      {summary.saving ? <Rings saving={summary.saving} /> : null}

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
                <span class="buai-dash__quantity">{quantity}</span> {one.count.toFixed(1)} {one.label}
                {one.stale ? ` (${staleNote(one.source)})` : ''}
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

/**
 * The saving as rings.
 *
 * One ring per recorded day, from the inside out. The gap a ring adds is that
 * day's saving as a share of the whole, so a week that leant on smaller models
 * grows outward and a week on the frontier model adds hairlines and nothing
 * else. A day with nothing saved still draws, thin, because a day of frontier
 * use is a fact about the week and not something to hide.
 *
 * Static on purpose. The brief pictured rings accreting in motion; a saving
 * is earned over days, and a picture that finishes growing in two seconds
 * would be saying otherwise.
 */
const Rings = ({ saving }: { saving: Saving }) => {
  const total = saving.energyWh?.central ?? 0;
  const inner = 14;
  const room = 78;
  let radius = inner;
  const rings = saving.byDay.map((day) => {
    const share = total > 0 ? (day.energyWh?.central ?? 0) / total : 0;
    const grow = share * room;
    radius += Math.max(1.5, grow);
    return { day: day.day, radius, grew: grow > 1.5 };
  });

  return (
    <section class="buai-dash__saving">
      <h2>What smaller models saved</h2>
      <div class="buai-dash__saving-row">
        <svg class="buai-dash__rings" viewBox="0 0 200 200" role="img" aria-label={`${rings.length} rings, one per day, growing with the energy saved that day`}>
          <circle cx="100" cy="100" r={inner} class="buai-dash__ring buai-dash__ring--core" />
          {rings.map((ring) => (
            <circle
              key={ring.day}
              cx="100"
              cy="100"
              r={ring.radius}
              class={ring.grew ? 'buai-dash__ring buai-dash__ring--grew' : 'buai-dash__ring'}
            />
          ))}
        </svg>
        <div class="buai-dash__saving-figures">
          <Readout label="Energy not drawn" value={saving.energyWh} unit="Wh" />
          <p class="buai-dash__saving-note">
            Against {saving.baseline}, priced on the same rows, region and boundary as everything
            else here. A turn that was already on the largest model saved nothing.
            {saving.skipped > 0
              ? ` ${saving.skipped} ${saving.skipped === 1 ? 'turn' : 'turns'} could not be re-priced and ${saving.skipped === 1 ? 'is' : 'are'} not in the figure.`
              : ''}
          </p>
        </div>
      </div>
    </section>
  );
};

const short = (value: Range | null | undefined, unit: string): string => {
  // Undefined as well as null. A row written by an older version can be
  // missing the field entirely, and reading through it crashed the page.
  if (value === null || value === undefined) return 'unknown';
  const scaled = scaleUnit(value.central, unit);
  return `${displayNumber(scaled.value)} ${scaled.unit}`;
};
