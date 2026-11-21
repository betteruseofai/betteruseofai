import { aggregate } from '@betteruseofai/core';
import type { Aggregate, Dataset, Estimate, UsageEvent } from '@betteruseofai/core';

/**
 * One row per model, with the turns whose model we assumed in rows of their
 * own. A signed-out ChatGPT turn priced as GPT-5.6 and a signed-in one that
 * said GPT-5.6 are different claims, and one row holding both would have to
 * call the whole of it assumed or none of it.
 *
 * The assumed rows carry the `model-assumed` flag and the others never do, so
 * the label can be read off the flags.
 */
export const modelRows = (pairs: { event: UsageEvent; estimate: Estimate }[]): Aggregate[] => [
  ...aggregate(
    pairs.filter((one) => one.event.modelAssumed !== true),
    'model',
  ),
  ...aggregate(
    pairs.filter((one) => one.event.modelAssumed === true),
    'model',
  ),
];

export const isAssumedRow = (row: Aggregate): boolean => row.flags.includes('model-assumed');

/** The name a model row goes by, and whether we assumed it. */
export const modelRowName = (row: Aggregate, unknown: string): string =>
  row.key === 'unknown' ? unknown : `${row.key}${isAssumedRow(row) ? ', assumed' : ''}`;

/**
 * One line for each model we assumed. Signed-out ChatGPT is the only place
 * that happens, so the line says so.
 */
export const assumedNotes = (byModel: Aggregate[], dataset: Dataset): string[] =>
  byModel.filter(isAssumedRow).map((row) => {
    // A word joiner after each hyphen, so "GPT-5.6" never breaks across two lines.
    const name = (dataset.models.find((model) => model.id === row.key)?.displayName ?? row.key).replaceAll(
      '-',
      '-⁠',
    );
    const turns = row.count === 1 ? 'that turn' : `those ${row.count} turns`;
    return `Signed out, ChatGPT doesn't say which model answered, so we've priced ${turns} as ${name}. That's our guess, hence the ~.`;
  });

/** A key that tells the assumed row from the reported one for the same model. */
export const modelRowKey = (row: Aggregate): string => `${row.key}${isAssumedRow(row) ? ':assumed' : ''}`;
