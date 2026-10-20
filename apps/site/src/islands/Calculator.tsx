/**
 * The calculator.
 *
 * The only island on the site, and the only place the whole dataset reaches a
 * browser. It runs the same engine as the extension and both command line
 * tools, so a number here and a number in your terminal come from one code
 * path.
 *
 * State lives in the part of the address after the hash. Browsers never send
 * that to a server, so a link you paste to somebody carries your figures
 * without any of them reaching a log on the way.
 */

import { useEffect, useMemo, useState } from 'preact/hooks';
import dataset from '../lib/dataset';
import {
  equivalents,
  estimate,
  displayNumber,
  explainFlags,
  resolveModel,
  scaleUnit,
} from '@betteruseofai/core';
import type { Estimate, Range, UsageEvent, WaterScope } from '@betteruseofai/core';

// ------------------------------------------------------------------- state

interface Dials {
  model: string;
  local: string;
  region: string;
  prompts: number;
  inputTokens: number;
  outputTokens: number;
  period: 'day' | 'month' | 'year';
  scope: WaterScope;
  compare: boolean;
}

const START: Dials = {
  model: 'claude-opus-5',
  local: 'llama-3.1-8b',
  region: 'WORLD',
  prompts: 20,
  inputTokens: 400,
  outputTokens: 300,
  period: 'day',
  scope: 'on-site + off-site',
  compare: false,
};

const PERIODS: Record<Dials['period'], number> = { day: 1, month: 30.4, year: 365 };

/** The largest values a dial accepts, the same whether typed or read from a link. */
const LIMITS = { prompts: 2000, inputTokens: 200000, outputTokens: 200000 } as const;

/**
 * A number box that keeps what is being typed and commits only a whole number
 * from one to its limit. Clearing the box to retype no longer snaps it to 1,
 * and nothing negative or fractional reaches the figures or the link.
 */
const WholeNumber = ({
  value,
  max,
  onCommit,
}: {
  value: number;
  max: number;
  onCommit: (next: number) => void;
}) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      min="1"
      max={String(max)}
      step="1"
      inputMode="numeric"
      value={text}
      onInput={(e) => {
        const typed = e.currentTarget.value;
        setText(typed);
        const parsed = Number(typed);
        if (typed.trim() !== '' && Number.isFinite(parsed) && parsed >= 1) {
          onCommit(Math.min(Math.round(parsed), max));
        }
      }}
      // Whatever was left half typed, the box shows the figure in use.
      onBlur={() => setText(String(value))}
    />
  );
};

const REPLIES = [
  { label: 'a sentence', output: 60 },
  { label: 'a paragraph', output: 150 },
  { label: 'a few paragraphs', output: 300 },
  { label: 'a page', output: 700 },
  { label: 'a long document', output: 2000 },
];

/** What a link asked for that the dataset doesn't have, by dial, as the link wrote it. */
type Dropped = Partial<Record<'model' | 'local' | 'region', string>>;

/**
 * Reads the dials out of the address, falling back to the defaults. A model
 * or region we don't have falls back too, and is kept in `dropped` so the
 * page can say what it used instead.
 */
const readHash = (): { dials: Dials; dropped: Dropped } => {
  const none = { dials: START, dropped: {} };
  if (typeof window === 'undefined') return none;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return none;
  const params = new URLSearchParams(raw);
  const dropped: Dropped = {};
  const pick = (key: keyof Dropped, find: (asked: string) => string | null): string => {
    const asked = params.get(key);
    if (asked === null) return START[key];
    const found = find(asked);
    if (found === null) dropped[key] = asked;
    return found ?? START[key];
  };
  const number = (key: string, fallback: number): number => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const period = params.get('period');
  const scope = params.get('scope');
  const dials: Dials = {
    // Aliases count, so a provider's own name for a model still finds it.
    model: pick('model', (asked) => resolveModel(asked, dataset)?.id ?? null),
    local: pick('local', (asked) => {
      const model = resolveModel(asked, dataset);
      return model?.hosting === 'both' ? model.id : null;
    }),
    region: pick(
      'region',
      (asked) =>
        dataset.regions.find((region) => region.code.toUpperCase() === asked.toUpperCase())
          ?.code ?? null,
    ),
    prompts: Math.min(Math.round(number('prompts', START.prompts)), LIMITS.prompts),
    inputTokens: Math.min(Math.round(number('in', START.inputTokens)), LIMITS.inputTokens),
    outputTokens: Math.min(Math.round(number('out', START.outputTokens)), LIMITS.outputTokens),
    period: period === 'month' || period === 'year' ? period : 'day',
    scope:
      scope === 'on-site' || scope === 'lifecycle' ? (scope as WaterScope) : START.scope,
    compare: params.get('compare') === '1',
  };
  return { dials, dropped };
};

const writeHash = (dials: Dials): void => {
  const params = new URLSearchParams({
    model: dials.model,
    region: dials.region,
    prompts: String(dials.prompts),
    in: String(dials.inputTokens),
    out: String(dials.outputTokens),
    period: dials.period,
    scope: dials.scope,
  });
  if (dials.compare) {
    params.set('compare', '1');
    params.set('local', dials.local);
  }
  const next = `#${params.toString()}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next);
  }
};

// ------------------------------------------------------------------ engine

const eventFor = (dials: Dials, modelId: string, hosting: 'cloud' | 'local'): UsageEvent => ({
  id: 'calculator',
  surface: 'api',
  hosting,
  modelRaw: modelId,
  modelId,
  tokens: {
    input: Math.round(dials.inputTokens),
    output: Math.round(dials.outputTokens),
    thinking: null,
    estimated: true,
    estimator: 'typed-by-hand',
  },
  timestamp: new Date().toISOString(),
});

const times = (range: Range | null, factor: number): Range | null =>
  range ? { low: range.low * factor, central: range.central * factor, high: range.high * factor } : null;

/**
 * Puts a whole range into one unit.
 *
 * scaleUnit works on a single number, so calling it per bound would print a
 * low in millilitres beside a high in litres. The unit is chosen once, from
 * the central figure, and the other two bounds follow it.
 */
const inOneUnit = (range: Range, unit: string): { range: Range; unit: string } => {
  const picked = scaleUnit(range.central, unit);
  const divide = picked.value === 0 ? 1 : range.central / picked.value;
  return {
    unit: picked.unit,
    range: { low: range.low / divide, central: picked.value, high: range.high / divide },
  };
};

// --------------------------------------------------------------- rendering

const show = (value: number): string => displayNumber(value);

/**
 * Says what a link asked for that we don't have, and what we used instead, so
 * whoever opens it knows their figures differ from the sender's.
 */
const Substituted = ({ what, asked, used }: { what: string; asked?: string; used: string }) =>
  asked === undefined ? null : (
    <p class="note calc__swap" role="status">
      The link asked for {what} <code>{asked.length > 40 ? `${asked.slice(0, 40)}…` : asked}</code>.
      We don't have that one, so we're using {used}.
    </p>
  );

const Figure = ({
  label,
  range,
  unit,
  atLeast,
  note,
}: {
  label: string;
  range: Range | null;
  unit: string;
  atLeast: boolean;
  note?: string;
}) => {
  if (!range) {
    return (
      <div class="buai-readout buai-readout--unknown">
        <span class="buai-readout__label">{label}</span>
        <span class="buai-readout__figure">unknown</span>
        <span class="buai-readout__bounds">{note ?? 'we have no figure for this'}</span>
      </div>
    );
  }

  const scaled = inOneUnit(range, unit);
  const pc = (value: number): string =>
    `${Math.min(100, (value / scaled.range.high) * 100).toFixed(1)}%`;

  return (
    <div>
      <div class="buai-readout">
        <span class="buai-readout__label">{label}</span>
        <span class="buai-readout__figure">
          {atLeast ? '≥ ' : ''}
          {show(scaled.range.central)}
          <span class="buai-readout__unit">{scaled.unit}</span>
        </span>
        <span class="buai-readout__bounds">
          [ {show(scaled.range.low)} to {show(scaled.range.high)} ]
          {note ? ` · ${note}` : ''}
        </span>
      </div>
      <div
        class="buai-rangebar"
        role="img"
        aria-label={`From ${show(scaled.range.low)} to ${show(scaled.range.high)} ${scaled.unit}`}
        style={{
          '--buai-low': pc(scaled.range.low),
          '--buai-central': pc(scaled.range.central),
          '--buai-high': '100%',
        } as never}
      >
        <div class="buai-rangebar__band" />
        <div class="buai-rangebar__hazard" />
        <div class="buai-rangebar__tick" />
      </div>
      <div class="buai-rangebar__scale">
        <span>{show(scaled.range.low)}</span>
        <span>{show(scaled.range.central)}</span>
        <span>{show(scaled.range.high)}</span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ island

export default function Calculator() {
  const [dials, setDials] = useState<Dials>(START);
  const [dropped, setDropped] = useState<Dropped>({});
  const [ready, setReady] = useState(false);

  // The address is only readable in the browser, so the first render matches
  // what the server sent and the dials arrive a tick later.
  useEffect(() => {
    const read = readHash();
    setDials(read.dials);
    setDropped(read.dropped);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeHash(dials);
  }, [dials, ready]);

  const set = <K extends keyof Dials>(key: K, value: Dials[K]): void => {
    setDials((current) => ({ ...current, [key]: value }));
    // Once somebody picks for themselves, the note about the link has done its job.
    setDropped((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as keyof Dropped];
      return next;
    });
  };

  const nameOf = (id: string): string =>
    dataset.models.find((model) => model.id === id)?.displayName ?? id;
  const regionName = (code: string): string =>
    dataset.regions.find((region) => region.code === code)?.name ?? code;

  const cloud = useMemo<Estimate>(
    () =>
      estimate(eventFor(dials, dials.model, 'cloud'), {
        dataset,
        regionCode: dials.region,
        waterScope: dials.scope,
      }),
    [dials],
  );

  const local = useMemo<Estimate | null>(
    () =>
      dials.compare
        ? estimate(eventFor(dials, dials.local, 'local'), {
            dataset,
            regionCode: dials.region,
            waterScope: dials.scope,
          })
        : null,
    [dials],
  );

  const factor = dials.prompts * PERIODS[dials.period];
  const atLeast = cloud.basis.flags.includes('thinking-unknown');

  const energy = times(cloud.energyWh, factor);
  const water = times(cloud.waterMl, factor);
  const carbon = times(cloud.carbonG, factor);

  const energyLike = equivalents(energy?.central ?? null, 'energy', dataset);
  const waterLike = equivalents(water?.central ?? null, 'water', dataset);
  const carbonLike = equivalents(carbon?.central ?? null, 'carbon', dataset);

  // Every model in the dataset is served by somebody. The open-weight ones
  // are marked "both", and those are the only ones you can run yourself.
  const cloudModels = dataset.models;
  const localModels = dataset.models.filter((model) => model.hosting === 'both');

  const continents = [...new Set(dataset.regions.map((region) => region.continent))];

  const verdict = ((): string | null => {
    if (!local || !cloud.energyWh || !local.energyWh) return null;
    const ratio = local.energyWh.central / cloud.energyWh.central;
    if (ratio < 0.5) return `Your own machine looks lighter here, by roughly ${show(1 / ratio)} times.`;
    if (ratio > 2) return `Your own machine looks heavier here, by roughly ${show(ratio)} times.`;
    return 'The two land close enough together that the ranges overlap. Neither is clearly better.';
  })();

  const plain = (): string => {
    const line = (label: string, range: Range | null, unit: string): string => {
      if (!range) return `${label.padEnd(10)} unknown`;
      const scaled = inOneUnit(range, unit);
      return `${label.padEnd(10)} ${show(scaled.range.central)} ${scaled.unit}  [ ${show(scaled.range.low)} to ${show(scaled.range.high)} ]`;
    };
    return [
      'Better Use of AI, estimate',
      '='.repeat(72),
      `Model      ${dials.model}`,
      `Region     ${dials.region}`,
      `Work       ${dials.prompts} prompts a day over a ${dials.period}, ${show(factor)} in all`,
      `Tokens     ${dials.inputTokens} in, ${dials.outputTokens} out, each`,
      `Water      ${dials.scope}`,
      '',
      line('Energy', energy, 'Wh'),
      line('Water', water, 'mL'),
      line('Carbon', carbon, 'g'),
      '',
      'This is an estimate, not a measurement.',
      ...cloud.basis.flags.map((flag) => `  - ${explainFlags([flag])[0] ?? flag}`),
      '',
      ...cloud.basis.sources.map((source) => `  ${source.title}, ${source.publisher}, ${source.url}`),
      '',
      `Dataset ${dataset.version}`,
    ].join('\n');
  };

  const [copied, setCopied] = useState(false);

  return (
    <div class="calc">
      <form class="calc__dials" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend class="note">The work</legend>

          <label>
            Model
            <select value={dials.model} onInput={(e) => set('model', e.currentTarget.value)}>
              {cloudModels.map((model) => (
                <option value={model.id} key={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
          <Substituted what="a model called" asked={dropped.model} used={nameOf(dials.model)} />

          <label>
            Prompts a day
            <WholeNumber
              value={dials.prompts}
              max={LIMITS.prompts}
              onCommit={(next) => set('prompts', next)}
            />
          </label>

          <label>
            Over
            <select
              value={dials.period}
              onInput={(e) => set('period', e.currentTarget.value as Dials['period'])}
            >
              <option value="day">a day</option>
              <option value="month">a month</option>
              <option value="year">a year</option>
            </select>
          </label>
          {dials.period === 'day' ? null : (
            <p class="note" aria-live="polite">
              About {show(factor)} prompts over the {dials.period}.
            </p>
          )}

          <label>
            Tokens you send
            <WholeNumber
              value={dials.inputTokens}
              max={LIMITS.inputTokens}
              onCommit={(next) => set('inputTokens', next)}
            />
          </label>

          <label>
            Reply length
            <select
              value={String(dials.outputTokens)}
              onInput={(e) => set('outputTokens', Number(e.currentTarget.value))}
            >
              {REPLIES.some((reply) => reply.output === dials.outputTokens) ? null : (
                <option value={String(dials.outputTokens)}>
                  about {dials.outputTokens} tokens, from the link
                </option>
              )}
              {REPLIES.map((reply) => (
                <option value={String(reply.output)} key={reply.label}>
                  {reply.label}, about {reply.output} tokens
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend class="note">The setting</legend>

          <label>
            Electricity from
            <select value={dials.region} onInput={(e) => set('region', e.currentTarget.value)}>
              {continents.map((continent) => (
                <optgroup label={continent} key={continent}>
                  {dataset.regions
                    .filter((region) => region.continent === continent)
                    .map((region) => (
                      <option value={region.code} key={region.code}>
                        {region.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Substituted what="a region called" asked={dropped.region} used={regionName(dials.region)} />

          <label>
            Water counted as
            <select
              value={dials.scope}
              onInput={(e) => set('scope', e.currentTarget.value as WaterScope)}
            >
              <option value="on-site">on site only</option>
              <option value="on-site + off-site">on site and at the power station</option>
              <option value="lifecycle">the whole life of the hardware</option>
            </select>
          </label>

          <label class="calc__check" for="calc-compare">
            <input
              id="calc-compare"
              type="checkbox"
              checked={dials.compare}
              onInput={(e) => set('compare', e.currentTarget.checked)}
            />
            Compare with running a model myself
          </label>

          {dials.compare ? (
            <label>
              On my machine
              <select value={dials.local} onInput={(e) => set('local', e.currentTarget.value)}>
                {localModels.map((model) => (
                  <option value={model.id} key={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {dials.compare ? (
            <Substituted
              what="a model to run yourself called"
              asked={dropped.local}
              used={nameOf(dials.local)}
            />
          ) : null}
        </fieldset>
      </form>

      <div class="calc__out">
        <div class="cols">
          <Figure label={`Energy a ${dials.period}`} range={energy} unit="Wh" atLeast={atLeast} />
          <Figure
            label={`Water a ${dials.period}, ${dials.scope}`}
            range={water}
            unit="mL"
            atLeast={atLeast}
          />
          <Figure label={`Carbon a ${dials.period}`} range={carbon} unit="g" atLeast={atLeast} />
        </div>

        {energyLike.length + waterLike.length + carbonLike.length > 0 ? (
          <div class="calc__like stack">
            <p class="note">About the same as</p>
            {/*
              Grouped, because an energy comparison and a water comparison read
              as contradictory when they sit in one list. A kettle of water
              boiled is a quantity of energy; a glass of water is water.
            */}
            {(
              [
                ['Energy', energyLike],
                ['Water', waterLike],
                ['Carbon', carbonLike],
              ] as const
            ).map(([heading, list]) =>
              list.length > 0 ? (
                <div key={heading}>
                  <p class="note calc__like-head">{heading}</p>
                  <ul>
                    {list.map((item) => (
                      <li key={item.id}>
                        {show(item.count)} {item.label}
                        {item.stale ? ' (the figure behind this one is old)' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        {local ? (
          <div class="calc__local stack">
            <p class="note">On your own machine</p>
            <div class="cols">
              <Figure
                label="Energy"
                range={times(local.energyWh, factor)}
                unit="Wh"
                atLeast={false}
              />
              <Figure label="Water" range={times(local.waterMl, factor)} unit="mL" atLeast={false} />
              <Figure label="Carbon" range={times(local.carbonG, factor)} unit="g" atLeast={false} />
            </div>
            {verdict ? <p class="measure">{verdict}</p> : null}
            <div class="buai-hazard measure">
              <span class="buai-hazard__label">Before you act on that</span>
              <p style="margin-bottom: 0">
                The local figure comes from a formula, not a measurement, and it assumes your
                accelerator is kept busy. One case we checked against a real card came out about a
                third low. Read it as the bottom of a range.
              </p>
            </div>
          </div>
        ) : null}

        <details class="buai-source calc__why">
          <summary>Where this range comes from</summary>
          <span class="buai-source__body">
            <ul>
              {explainFlags(cloud.basis.flags).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <ul>
              {cloud.basis.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url}>{source.title}</a>
                  <span class="buai-source__meta">
                    {source.publisher} · {source.date}
                  </span>
                </li>
              ))}
            </ul>
          </span>
        </details>

        <div class="row">
          <button
            class="buai-button"
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(plain()).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Copied as text' : 'Copy as text'}
          </button>
          <a class="buai-button buai-button--quiet" href="/methodology">
            Read the method
          </a>
        </div>
      </div>
    </div>
  );
}
