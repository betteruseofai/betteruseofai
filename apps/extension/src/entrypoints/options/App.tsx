import type { Dataset } from '@betteruseofai/core';
import { useEffect, useState } from 'preact/hooks';

import { Hazard, MetaStrip } from '../../ui/Readout.js';
import { DEFAULT_SETTINGS } from '../../lib/storage.js';
import type { Settings } from '../../lib/storage.js';
import { browser } from 'wxt/browser';

/**
 * The options page.
 *
 * It carries the settings, and it carries the promises. The section at the
 * bottom says what this extension never does, and the button beside it deletes
 * everything, immediately and without asking twice, because a privacy claim
 * you cannot act on is a slogan.
 */

const RETENTION_CHOICES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '180 days' },
  { days: 365, label: 'a year' },
  { days: 0, label: 'as long as I keep it' },
];

export const App = ({ dataset }: { dataset: Dataset }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [count, setCount] = useState(0);
  const [forgotten, setForgotten] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = (): void => {
    void browser.runtime
      .sendMessage({ type: 'summary:get' })
      .then((value) => {
        const summary = value as { settings: Settings; count: number };
        setSettings(summary.settings);
        setCount(summary.count);
      })
      .catch(() => undefined);
  };

  useEffect(load, []);

  const change = (patch: Partial<Settings>): void => {
    void browser.runtime
      .sendMessage({ type: 'settings:set', patch })
      .then((value) => setSettings(value as Settings))
      .catch(() => undefined);
  };

  const continents = [...new Set(dataset.regions.map((one) => one.continent ?? 'Global'))].sort();

  return (
    <main class="buai-options">
      <h1>Settings</h1>

      <section class="buai-options__section">
        <h2>Where on Earth</h2>
        <p>
          Carbon depends on the grid that made the electricity, and a unit of it can carry about
          twenty times more carbon on one grid than on another. Until you tell us, we assume you
          live in the world average, which nobody does.
        </p>
        <label class="buai-options__field">
          <span class="buai-readout__label">Region</span>
          <select
            value={settings.regionCode ?? ''}
            onChange={(event) =>
              change({ regionCode: (event.currentTarget as HTMLSelectElement).value || null })
            }
          >
            <option value="">World average</option>
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
      </section>

      <section class="buai-options__section">
        <h2>Where we stop counting</h2>
        <p>
          Published water figures differ by more than a hundred times, and nearly all of that is
          down to where each company stops counting. Google counts the water its cooling towers
          evaporate. Mistral counts that and keeps going: the water used to generate the
          electricity, and the water that went into building the hardware. The last choice below
          counts building the hardware for carbon too. Hardly anyone publishes that share, so under
          it water and carbon read as "at least".
        </p>
        {(['on-site', 'on-site + off-site', 'lifecycle'] as const).map((scope) => (
          <label class="buai-options__radio" key={scope}>
            <input
              type="radio"
              name="water-scope"
              checked={settings.waterScope === scope}
              onChange={() => change({ waterScope: scope })}
            />
            <span>
              <strong>{scope}</strong>
              <span class="buai-options__hint">
                {scope === 'on-site'
                  ? "Cooling at the building. That's it."
                  : scope === 'on-site + off-site'
                    ? 'Adds the water the power station used. The default.'
                    : 'Adds building the hardware, for water and carbon, where anyone has published it.'}
              </span>
            </span>
          </label>
        ))}
      </section>

      <section class="buai-options__section">
        <h2>Which carbon figure</h2>
        <p>
          A provider's market-based figure tells you what it bought. The electricity it used came
          off the local grid like everyone else's, and the bought version is kinder: Google's own
          two figures differ by three and a half times. We default to location-based for that
          reason.
        </p>
        {(['location-based', 'provider-reported'] as const).map((basis) => (
          <label class="buai-options__radio" key={basis}>
            <input
              type="radio"
              name="carbon-basis"
              checked={settings.carbonBasis === basis}
              onChange={() => change({ carbonBasis: basis })}
            />
            <span>
              <strong>{basis}</strong>
            </span>
          </label>
        ))}
      </section>

      <section class="buai-options__section">
        <h2>Nudges</h2>
        <label class="buai-options__radio">
          <input
            type="checkbox"
            checked={settings.hintsEnabled}
            onChange={(event) =>
              change({ hintsEnabled: (event.currentTarget as HTMLInputElement).checked })
            }
          />
          <span>
            <strong>Say something before I send</strong>
            <span class="buai-options__hint">
              Only when a rule is sure of itself, and never for anything that looks like real work.
              Every nudge says which rule spoke up.
            </span>
          </span>
        </label>
        <label class="buai-options__radio">
          <input
            type="checkbox"
            checked={settings.hasLocalModel}
            onChange={(event) =>
              change({ hasLocalModel: (event.currentTarget as HTMLInputElement).checked })
            }
          />
          <span>
            <strong>I run models on this machine</strong>
            <span class="buai-options__hint">
              Off by default. We won't recommend a tool you haven't told us you have.
            </span>
          </span>
        </label>
      </section>

      <section class="buai-options__section">
        <h2>What we keep</h2>
        <p>
          Counts, timestamps and model names, in this browser. Your prompts and the answers are
          never stored, not even a scrap. Turns older than this are deleted.
        </p>
        <label class="buai-options__field">
          <span class="buai-readout__label">Keep for</span>
          <select
            /*
             * Falls back to the default when the stored value is not one of
             * the choices. Without this the control renders blank, which tells
             * the reader their data is kept for no time at all.
             */
            value={
              RETENTION_CHOICES.some((one) => one.days === settings.retentionDays)
                ? String(settings.retentionDays)
                : String(DEFAULT_SETTINGS.retentionDays)
            }
            onChange={(event) =>
              change({
                retentionDays: Number.parseInt((event.currentTarget as HTMLSelectElement).value, 10),
              })
            }
          >
            {RETENTION_CHOICES.map((one) => (
              <option value={String(one.days)} key={one.days}>
                {one.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <Hazard label="What this never does">
        <p>
          It opens no connection of its own. There's no backend and no account, nothing phones
          home, and the benchmark figures ship inside the extension so there's nothing to fetch.
          The only addresses it reads are the three chat sites.
        </p>
        <p style="margin-bottom:0">
          Don't take our word for it. Open the network panel and watch: the extension makes no
          requests of its own, ever.
        </p>
      </Hazard>

      <section class="buai-options__section">
        <h2>Forget everything</h2>
        <p>
          We're holding {count} turns. This deletes the lot. There's no undo and no copy anywhere
          else, because there never was an anywhere else.
        </p>
        {/* Two presses, because one slip of the mouse would lose every turn for good. */}
        {confirming ? (
          <div class="buai-options__confirm" role="alertdialog" aria-label="Delete every stored turn">
            <p>
              Delete all {count} turns? There's no undo.
            </p>
            <button
              class="buai-button"
              type="button"
              onClick={() => {
                void browser.runtime.sendMessage({ type: 'events:forget' }).then(() => {
                  setConfirming(false);
                  setForgotten(true);
                  setCount(0);
                });
              }}
            >
              Yes, delete them
            </button>{' '}
            <button class="buai-button buai-button--quiet" type="button" onClick={() => setConfirming(false)}>
              Keep them
            </button>
          </div>
        ) : (
          <button
            class="buai-button"
            type="button"
            disabled={count === 0}
            onClick={() => {
              setForgotten(false);
              setConfirming(true);
            }}
          >
            Delete everything stored
          </button>
        )}
        {forgotten ? <p class="buai-options__hint">Gone.</p> : null}
      </section>

      <MetaStrip
        items={[`dataset ${dataset.version}`, `sha ${dataset.sha256.slice(0, 12)}`, 'telemetry: none', 'MIT']}
      />
    </main>
  );
};
