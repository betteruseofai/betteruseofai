import { equivalents } from '@betteruseofai/core';
import type { Aggregate, Dataset } from '@betteruseofai/core';
import { useEffect, useState } from 'preact/hooks';

import { Hazard, MetaStrip, Readout, staleNote } from '../../ui/Readout.js';
import type { Settings } from '../../lib/storage.js';
import { browser } from 'wxt/browser';

/**
 * The popup: 360 pixels of what this browser has cost.
 *
 * Energy leads, because it is the measured quantity and the other two are
 * worked out from it; water and carbon follow at the usual size. Then the meta
 * strip, and whatever caveats apply. It shows what it knows and says plainly
 * what it does not, which on a first run is everything.
 *
 * The first run asks one question, where you are, because region moves the
 * carbon figure by a factor of about twenty and the world average is wrong for
 * nearly everyone. It asks once, offers the average as an answer, and never
 * asks again.
 */

interface Summary {
  settings: Settings;
  datasetVersion: string;
  total: Aggregate | null;
  byDay: Aggregate[];
  byModel: Aggregate[];
  health: Record<string, { state: string; version: number; at: string }>;
  count: number;
}

export const App = ({ dataset }: { dataset: Dataset }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  const load = (): void => {
    void browser.runtime
      .sendMessage({ type: 'summary:get' })
      .then((value) => setSummary(value as Summary))
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    load();
    const onChange = (message: { type?: string }): void => {
      if (message?.type === 'events:changed') load();
    };
    browser.runtime.onMessage.addListener(onChange);
    return () => browser.runtime.onMessage.removeListener(onChange);
  }, []);

  const change = (patch: Partial<Settings>): void => {
    void browser.runtime
      .sendMessage({ type: 'settings:set', patch })
      .then(() => load())
      .catch(() => undefined);
  };

  if (failed) {
    return (
      <main class="buai-popup">
        <div class="buai-standby">
          <span class="buai-standby__code">no reply</span>
          The background worker did not answer. Reload the extension and try again.
        </div>
      </main>
    );
  }

  if (!summary) {
    return (
      <main class="buai-popup">
        <p class="buai-readout__label">Reading what is stored</p>
      </main>
    );
  }

  const total = summary.total;
  const flags = total?.flags ?? [];

  /*
   * A first run has nothing to show, and saying so beats three zeroes. It is
   * also the one moment to ask where the reader is, before any carbon figure
   * has been shown against the wrong grid.
   */
  if (!total || total.count === 0) {
    const asked = summary.settings.regionAsked === true || summary.settings.regionCode !== null;
    return (
      <main class="buai-popup">
        <Header datasetVersion={summary.datasetVersion} />
        {!asked ? (
          <FirstRun dataset={dataset} onChoose={(code) => change({ regionCode: code, regionAsked: true })} />
        ) : null}
        <div class="buai-standby">
          <span class="buai-standby__code">nothing yet</span>
          Send a message on claude.ai, chatgpt.com or gemini.google.com and it will appear here.
          Nothing is counted until you do, and nothing leaves this machine when you have.
        </div>
      </main>
    );
  }

  const energyEquivalent = equivalents(total.energyWh?.central ?? null, 'energy', dataset, 1)[0];
  const degraded = Object.entries(summary.health).filter(([, one]) => one.state !== 'ok');

  const caveats: string[] = [];
  if (total.unknownModelCount > 0) {
    caveats.push(
      `${total.unknownModelCount} of ${total.count} turns used a model we do not recognise. They are counted but not priced, because a guess would be worse than a gap.`,
    );
  }
  if (degraded.length > 0) {
    caveats.push(
      `${degraded.map(([id]) => id).join(', ')} no longer looks the way we expect, so it has stopped counting. We would rather show nothing than a figure we cannot stand behind.`,
    );
  }

  return (
    <main class="buai-popup">
      <Header datasetVersion={summary.datasetVersion} />

      <Readout label="Energy" value={total.energyWh} unit="Wh" flags={flags} lead />
      <div class="buai-popup__pair">
        <Readout label="Water" value={total.waterMl} unit="mL" flags={flags} />
        <Readout label="Carbon" value={total.carbonG} unit="g" flags={flags} />
      </div>

      {energyEquivalent ? (
        <p class="buai-popup__equivalent">
          About {energyEquivalent.count.toFixed(1)} {energyEquivalent.label}
          {energyEquivalent.stale ? `, ${staleNote(energyEquivalent.source)}` : ''}.
        </p>
      ) : null}

      <div class="buai-popup__models">
        {summary.byModel.slice(0, 4).map((one) => (
          <div class="buai-popup__model" key={one.key}>
            <span>{one.key === 'unknown' ? 'unrecognised' : one.key}</span>
            <span class="buai-mono">{one.count}</span>
          </div>
        ))}
      </div>

      {/*
        * One hazard block, however many things are wrong. The design rules
        * allow a single one per view, and two stacked orange boxes read as an
        * error state rather than as a caveat.
        */}
      {caveats.length > 0 ? (
        <Hazard label={caveats.length === 1 ? 'Worth knowing' : 'Worth knowing, on both counts'}>
          {caveats.map((line) => (
            <p class="buai-popup__caveat" key={line}>
              {line}
            </p>
          ))}
        </Hazard>
      ) : null}

      {flags.includes('thinking-unknown') ? (
        <p class="buai-popup__note">
          Some turns hid their reasoning tokens, so these are lower bounds.
        </p>
      ) : null}

      <MetaStrip
        items={[
          `${total.count} turns`,
          `dataset ${summary.datasetVersion}`,
          `region ${summary.settings.regionCode ?? 'world'}`,
          'telemetry: none',
        ]}
      />

      <div class="buai-popup__actions">
        <button class="buai-button buai-button--quiet" type="button" onClick={() => openPage('dashboard')}>
          See the detail
        </button>
        <button class="buai-button buai-button--quiet" type="button" onClick={() => openPage('options')}>
          Change the settings
        </button>
      </div>
    </main>
  );
};

const Header = ({ datasetVersion }: { datasetVersion: string }) => (
  <header class="buai-popup__header">
    {/* The brand takes its own line at this width. Letting it share one with
        the tape wrapped it across two lines and broke the word in half. */}
    <span class="buai-popup__brand">Better Use of AI</span>
    <span class="buai-popup__tape">Estimate, not a measurement</span>
    <span class="buai-popup__hidden">{datasetVersion}</span>
  </header>
);

/**
 * The one question a first run asks. A select grouped by continent, one
 * button that says "the world average will do", and nothing else. Whatever
 * is chosen, the question is marked asked and does not come back; the options
 * page has the same control for later.
 */
const FirstRun = ({ dataset, onChoose }: { dataset: Dataset; onChoose: (code: string | null) => void }) => {
  const continents = [...new Set(dataset.regions.map((one) => one.continent ?? 'Global'))].sort();
  return (
    <section class="buai-popup__firstrun" data-first-run>
      <p class="buai-readout__label">One question before the first count</p>
      <p class="buai-popup__firstrun-why">
        Carbon depends on the grid your electricity comes from, and grids differ by a factor of
        about twenty. Where are you?
      </p>
      <label class="buai-popup__firstrun-field">
        <span class="buai-visually-hidden">Region</span>
        <select onChange={(event) => onChoose((event.currentTarget as HTMLSelectElement).value || null)}>
          <option value="">Pick a region</option>
          {continents.map((continent) => (
            <optgroup label={continent} key={continent}>
              {dataset.regions
                .filter((one) => (one.continent ?? 'Global') === continent)
                .map((one) => (
                  <option value={one.code} key={one.code}>
                    {one.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button class="buai-button buai-button--quiet" type="button" onClick={() => onChoose(null)}>
        Use the world average
      </button>
    </section>
  );
};

/**
 * Opens one of the extension's own pages.
 *
 * The two are named explicitly rather than built from a string, because WXT
 * types getURL against the pages that actually exist and a template would let
 * a typo through to a dead tab.
 */
const openPage = (page: 'dashboard' | 'options'): void => {
  const url = page === 'dashboard' ? browser.runtime.getURL('/dashboard.html') : browser.runtime.getURL('/options.html');
  void browser.tabs?.create({ url });
};
