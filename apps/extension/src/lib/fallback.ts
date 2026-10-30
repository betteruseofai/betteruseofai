import type { CapturedTurn, SiteAdapter } from '../adapters/types.js';
import type { StoredEvent } from './storage.js';

/**
 * The page fallback.
 *
 * The network read is the real source: it sees the model that answered and,
 * sometimes, the site's own counts. But a site can change its endpoint or its
 * stream overnight, and until the adapter catches up those turns would simply
 * vanish. So when somebody sends a prompt and no network turn arrives for it,
 * the answer is read off the page instead, and counted as an estimate.
 *
 * Three rules keep it from counting what it shouldn't. It counts only after a
 * send on this page, so history that loads with a conversation is never a turn.
 * It counts only an answer that has finished, and only one past the number
 * already on the page. And a network turn for the same send cancels it; the
 * background also drops a page turn that lands beside a network one.
 */

export interface Fallback {
  /** Somebody sent a prompt from this page. */
  sent(): void;
  /** The network read a turn, so the page has nothing to add for this send. */
  captured(): void;
  /** Looks at the page once it has gone quiet. A turn to count, or null. */
  check(document: Document, url: string, at: string): CapturedTurn | null;
}

export const createFallback = (
  adapter: SiteAdapter,
  loadId: string,
  document: Document,
  url: string,
): Fallback => {
  let place = adapter.conversationIdFromUrl(url);
  // What is on the page when it loads was there before us.
  let baseline = adapter.readLastExchange(document)?.answers ?? 0;
  let waiting = false;
  let counted = 0;

  return {
    sent() {
      waiting = true;
    },

    captured() {
      waiting = false;
    },

    check(page, address, at) {
      const exchange = adapter.readLastExchange(page);
      const here = adapter.conversationIdFromUrl(address);
      if (here !== place) {
        // A new conversation gets its address after the first send, so that
        // move is the same conversation. Any other is a different one, and
        // whatever it shows was there before.
        const started = place === null && waiting;
        place = here;
        if (!started) {
          baseline = exchange?.answers ?? 0;
          return null;
        }
      }

      if (!exchange || exchange.answering || exchange.answers <= baseline) return null;
      baseline = exchange.answers;
      if (!waiting || exchange.output === '') return null;
      waiting = false;

      counted += 1;
      return {
        key: `${place ?? 'no-conversation'}:${loadId}:page${counted}`,
        conversationId: place,
        // Filled from the picker by the caller, as for a network turn.
        modelRaw: null,
        modelSource: 'unknown',
        inputText: exchange.input,
        outputText: exchange.output,
        // The page never says how much a model thought. The engine turns
        // this into a lower bound for a model that can, and ignores it for
        // one that can't.
        thinkingUndisclosed: true,
        at,
      };
    },
  };
};

/** A turn read off the page and a network turn this close together are the same turn. */
export const SAME_TURN_MS = 60_000;

/** Page turns a network turn arriving now should replace, because they are the same turn. */
export const replacedBy = (
  stored: ReadonlyArray<Pick<StoredEvent, 'id' | 'event'>>,
  network: { surface: string; conversationId?: string | undefined; timestamp: string },
): string[] => {
  const at = Date.parse(network.timestamp);
  return stored
    .filter(
      (one) =>
        /:page\d+$/.test(one.id) &&
        one.event.surface === network.surface &&
        one.event.conversationId === network.conversationId &&
        Math.abs(Date.parse(one.event.timestamp) - at) < SAME_TURN_MS,
    )
    .map((one) => one.id);
};

/** True when a network turn for the same conversation is already stored beside this page turn. */
export const alreadyCounted = (
  stored: ReadonlyArray<Pick<StoredEvent, 'id' | 'event'>>,
  page: { id: string; surface: string; conversationId?: string | undefined; timestamp: string },
): boolean => {
  const at = Date.parse(page.timestamp);
  return stored.some(
    (one) =>
      one.id === page.id ||
      (one.event.surface === page.surface &&
        one.event.conversationId === page.conversationId &&
        Math.abs(Date.parse(one.event.timestamp) - at) < SAME_TURN_MS),
  );
};
