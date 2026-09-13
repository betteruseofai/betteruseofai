/**
 * The numbers behind the sentence at the top of the landing page.
 *
 * Worked out at build time, not in the browser. The landing page has a budget
 * of 25 kB of JavaScript and the dataset alone is larger than that, so we run
 * the engine here for the handful of combinations the sentence offers and ship
 * a small table. The arithmetic left for the browser is one multiplication.
 *
 * Same engine, same dataset, same flags. Nothing is rounded or simplified on
 * the way out; the table holds full ranges and the page formats them.
 */

import dataset from './dataset';
import { estimate } from '@betteruseofai/core';
import type { Range, UsageEvent } from '@betteruseofai/core';

/** The choices the sentence offers, in the order they appear in the dropdown. */
export const CHOICES = [
  { id: 'claude-opus-5', label: 'a frontier model' },
  { id: 'claude-sonnet-5', label: 'a mid-sized model' },
  { id: 'claude-haiku-4.5', label: 'a small model' },
  { id: 'llama-3.1-8b', label: 'a small model on my own machine' },
] as const;

export const PLACES = [
  { code: 'WORLD', label: 'the world average grid' },
  { code: 'US', label: 'the United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'the United Kingdom' },
  { code: 'FR', label: 'France' },
  { code: 'SE', label: 'Sweden' },
  { code: 'AU', label: 'Australia' },
] as const;

export interface Cell {
  energyWh: Range | null;
  waterMl: Range | null;
  carbonG: Range | null;
  /** Set when the model thinks and did not say how much. */
  atLeast: boolean;
  flags: string[];
  /** The benchmark row the figure rests on, so the page can cite it. */
  rowId: string | null;
}

/**
 * One typical exchange. Roughly a paragraph in and three paragraphs out, which
 * is what the published per-prompt figures assume. Thinking is null rather
 * than zero, because a reasoning model that does not report its thinking has
 * not told us it did none.
 */
const TYPICAL = { input: 400, output: 300 };

const eventFor = (modelId: string): UsageEvent => ({
  id: `landing-${modelId}`,
  surface: 'api',
  hosting: modelId === 'llama-3.1-8b' ? 'local' : 'cloud',
  modelRaw: modelId,
  modelId,
  tokens: {
    input: TYPICAL.input,
    output: TYPICAL.output,
    thinking: null,
    estimated: true,
    estimator: 'landing-typical-exchange',
  },
  timestamp: '2026-09-11T00:00:00.000Z',
});

const cellFor = (modelId: string, regionCode: string): Cell => {
  const result = estimate(eventFor(modelId), { dataset, regionCode });
  return {
    energyWh: result.energyWh,
    waterMl: result.waterMl,
    carbonG: result.carbonG,
    atLeast: result.basis.flags.includes('thinking-unknown'),
    flags: result.basis.flags,
    rowId: result.basis.benchmarkRowId ?? null,
  };
};

/** Keyed `${modelId}|${regionCode}`, which is what the script looks up. */
export type LandingTable = Record<string, Cell>;

export const buildTable = (): LandingTable => {
  const table: LandingTable = {};
  for (const choice of CHOICES) {
    for (const place of PLACES) {
      table[`${choice.id}|${place.code}`] = cellFor(choice.id, place.code);
    }
  }
  return table;
};
