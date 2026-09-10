import { estimate } from '@betteruseofai/core';
import type { Dataset, TokenCounts, UsageEvent } from '@betteruseofai/core';
import { estimateTokens } from '@betteruseofai/tokenizers';

import type { CapturedTurn, SiteAdapter } from '../adapters/types.js';
import type { Settings, StoredEvent } from './storage.js';

/**
 * From a captured turn to a stored estimate.
 *
 * This is the only place prompt text exists in the extension, and it exists
 * for the length of one function call. Text comes in, tokens come out, the
 * text is dropped. Nothing downstream of here has ever seen it.
 */

/**
 * Turns whatever the site told us into token counts.
 *
 * A count the site reported always beats one we worked out. Local front ends
 * report exact figures and the cloud sites occasionally do; where they do, the
 * estimated flag comes off and the interface stops showing a tilde.
 */
export const countTokens = async (
  turn: CapturedTurn,
  adapter: SiteAdapter,
  dataset: Dataset,
): Promise<TokenCounts> => {
  const reported = turn.reportedTokens ?? {};
  const needsInput = reported.input === undefined;
  const needsOutput = reported.output === undefined;

  const [input, output] = await Promise.all([
    needsInput
      ? estimateTokens(turn.inputText, adapter.provider, dataset.calibration)
      : Promise.resolve(null),
    needsOutput
      ? estimateTokens(turn.outputText, adapter.provider, dataset.calibration)
      : Promise.resolve(null),
  ]);

  /*
   * Three states for thinking, and they are not interchangeable. A reported
   * count is used. An undisclosed count is null, which the engine turns into a
   * range from zero with a flag. And a model that cannot think gets undefined,
   * which is the only case where nothing is the right answer.
   */
  const thinking: number | null | undefined =
    reported.thinking !== undefined
      ? reported.thinking
      : turn.thinkingUndisclosed
        ? null
        : undefined;

  const estimated = needsInput || needsOutput;

  return {
    input: reported.input ?? input?.count ?? 0,
    output: reported.output ?? output?.count ?? 0,
    cachedRead: reported.cachedRead ?? 0,
    cachedWrite: 0,
    thinking,
    estimated,
    estimator: estimated ? (input ?? output)?.estimator ?? 'tokenizer' : 'provider',
  };
};

export const toEvent = async (
  turn: CapturedTurn,
  adapter: SiteAdapter,
  dataset: Dataset,
): Promise<UsageEvent> => ({
  id: `${adapter.id}:${turn.key}`,
  surface: adapter.surface,
  hosting: adapter.hosting,
  // Kept verbatim. An unrecognised string has to survive as one, so the
  // interface can say which model it did not know.
  modelRaw: turn.modelRaw ?? '',
  modelId: null,
  tokens: await countTokens(turn, adapter, dataset),
  timestamp: turn.at,
  ...(turn.conversationId ? { conversationId: turn.conversationId } : {}),
  meta: { adapterVersion: adapter.version, modelSource: turn.modelSource },
});

export const priceTurn = async (
  turn: CapturedTurn,
  adapter: SiteAdapter,
  dataset: Dataset,
  settings: Settings,
): Promise<StoredEvent> => {
  const event = await toEvent(turn, adapter, dataset);
  const priced = estimate(event, {
    dataset,
    ...(settings.regionCode ? { regionCode: settings.regionCode } : {}),
    waterScope: settings.waterScope,
    carbonBasis: settings.carbonBasis,
  });

  return {
    id: event.id,
    event,
    estimate: priced,
    datasetVersion: dataset.version,
    day: event.timestamp.slice(0, 10),
    surface: event.surface,
  };
};

/**
 * Re-prices stored events against a new dataset.
 *
 * Run after an update. The tokens were kept, so nothing has to be recounted,
 * and the interface shows a one time notice saying the numbers moved. Leaving
 * old estimates in place would mean two turns priced by different rules
 * sitting in the same total.
 */
export const reprice = (
  stored: StoredEvent[],
  dataset: Dataset,
  settings: Settings,
): { updated: StoredEvent[]; changed: number } => {
  let changed = 0;
  const updated = stored.map((one) => {
    if (one.datasetVersion === dataset.version) return one;
    changed += 1;
    return {
      ...one,
      datasetVersion: dataset.version,
      estimate: estimate(one.event, {
        dataset,
        ...(settings.regionCode ? { regionCode: settings.regionCode } : {}),
        waterScope: settings.waterScope,
        carbonBasis: settings.carbonBasis,
      }),
    };
  });
  return { updated, changed };
};

/**
 * Decides between a turn seen on the network and the same turn seen in the
 * page.
 *
 * The network one wins. It carries the model the site actually used and, on a
 * good day, real token counts; the page fallback has neither. They are matched
 * on the adapter's key, which is why that key has to be stable.
 */
export const reconcile = (
  fromNetwork: StoredEvent | undefined,
  fromPage: StoredEvent | undefined,
): StoredEvent | null => fromNetwork ?? fromPage ?? null;
