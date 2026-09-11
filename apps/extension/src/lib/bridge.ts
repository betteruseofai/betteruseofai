import { z } from 'zod';

import type { CapturedTurn, SiteAdapter } from '../adapters/types.js';
import { EVENT_NAME } from './interceptor.js';
import type { InterceptedExchange } from './interceptor.js';

/**
 * The isolated side of the bridge.
 *
 * Everything crossing from the page world is untrusted. The page can dispatch
 * the same event we do, so the nonce is checked and the payload is validated
 * before anything looks at it. A page that forges a turn should achieve
 * nothing worse than a dropped message.
 */

const exchangeSchema = z.object({
  url: z.string().max(4096),
  method: z.string().max(16),
  requestBody: z.string().max(8 * 1024 * 1024),
  responseBody: z.string().max(16 * 1024 * 1024),
  requestHeaders: z.record(z.string().max(256), z.string().max(4096)).default({}),
  at: z.string().max(64),
});

export const parseExchange = (
  detail: unknown,
  expectedNonce: string,
): InterceptedExchange | null => {
  if (!detail || typeof detail !== 'object') return null;
  const envelope = detail as { nonce?: unknown; exchange?: unknown };
  // A constant time comparison is not warranted: the nonce never leaves this
  // page, and the worst a wrong guess achieves is one accepted message.
  if (typeof envelope.nonce !== 'string' || envelope.nonce !== expectedNonce) return null;

  const parsed = exchangeSchema.safeParse(envelope.exchange);
  return parsed.success ? (parsed.data as InterceptedExchange) : null;
};

/** Builds a turn from an exchange, or nothing when the adapter cannot read it. */
export const turnFromExchange = (
  exchange: InterceptedExchange,
  adapter: SiteAdapter,
  turnIndex: number,
): CapturedTurn | null => {
  const request = adapter.parseRequest(exchange.requestBody, exchange.requestHeaders, exchange.url);
  const stream = adapter.parseStream(exchange.responseBody);

  // No response means no answer to count. A turn with an input and no output
  // would understate by most of its cost, so it is dropped rather than stored.
  if (!stream) return null;

  const conversationId =
    request?.conversationId ?? adapter.conversationIdFromUrl(exchange.url) ?? null;

  /*
   * The model, in order of how much we trust it. What the answer said beats
   * what the request asked for, which matters most on ChatGPT, where the two
   * genuinely differ. The page picker is last, and null is an acceptable
   * answer: the interface can say unknown.
   */
  const fromStream = stream.modelRaw;
  const fromRequest = request?.modelRaw ?? null;
  const modelRaw = fromStream ?? fromRequest;
  const modelSource: CapturedTurn['modelSource'] = fromStream
    ? stream.modelSource
    : fromRequest
      ? (request?.modelSource ?? 'request')
      : 'unknown';

  return {
    key: `${conversationId ?? 'no-conversation'}:${turnIndex}`,
    conversationId,
    modelRaw,
    modelSource,
    inputText: request?.inputText ?? '',
    outputText: stream.outputText,
    ...(stream.reportedTokens ? { reportedTokens: stream.reportedTokens } : {}),
    thinkingUndisclosed: stream.thinkingUndisclosed,
    at: exchange.at,
  };
};

/**
 * Fills in the model from the page when the network did not say.
 *
 * Called with the document because the adapter reads a picker out of it. The
 * result is marked as coming from the picker, so a figure resting on it can be
 * told apart from one resting on the answer itself.
 */
export const fillModelFromPage = (
  turn: CapturedTurn,
  adapter: SiteAdapter,
  document: Document,
): CapturedTurn => {
  if (turn.modelRaw) return turn;
  const fromPicker = adapter.readSelectedModel(document);
  if (!fromPicker) return turn;
  return { ...turn, modelRaw: fromPicker, modelSource: 'picker' };
};

export { EVENT_NAME };
