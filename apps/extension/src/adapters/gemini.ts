import type { AdapterHealth, ParsedRequest, ParsedStream, SiteAdapter } from './types.js';

/**
 * gemini.google.com
 *
 * The hardest of the three. The body is a protobuf-ish nested array encoded as
 * JSON inside a form field, with no field names anywhere, so parsing it by
 * shape would break on any reordering.
 *
 * We therefore read the model from a request header rather than the body:
 * `x-goog-ext-525001261-jspb` carries it. The DOM picker is the fallback, and
 * the result records which one it came from. Where neither is available the
 * model is null and the turn renders as unknown, which is the correct outcome.
 *
 * Text is pulled out by walking the nested arrays for strings long enough to
 * be prose. That is crude, and it is why the counts here are estimates and
 * flagged as such.
 */

const STREAM_ENDPOINT = /StreamGenerate/;
const MODEL_HEADER = 'x-goog-ext-525001261-jspb';
const CONVERSATION_IN_URL = /\/app\/([0-9a-f]{8,})/i;

/** Walks a nested array and collects strings that look like prose. */
export const harvestStrings = (value: unknown, minimum = 12, depth = 0): string[] => {
  if (depth > 12) return [];
  if (typeof value === 'string') return value.length >= minimum ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => harvestStrings(item, minimum, depth + 1));
  return [];
};

/** Parses the doubly encoded payload Gemini sends, without assuming a shape. */
export const decodeEnvelope = (body: string): unknown => {
  // The interesting part sits in an f.req form field, itself a JSON string.
  const params = new URLSearchParams(body);
  const request = params.get('f.req') ?? body;
  try {
    const outer = JSON.parse(request);
    if (Array.isArray(outer)) {
      for (const item of outer.flat(3)) {
        if (typeof item === 'string' && item.trim().startsWith('[')) {
          try {
            return JSON.parse(item);
          } catch {
            // Not the layer we wanted. Keep looking.
          }
        }
      }
    }
    return outer;
  } catch {
    return null;
  }
};

const readModelHeader = (headers: Record<string, string>): string | null => {
  const raw = headers[MODEL_HEADER] ?? headers[MODEL_HEADER.toUpperCase()];
  if (!raw) return null;
  // The header is itself a small JSON array. The model name is the longest
  // string in it that is not obviously a number or a flag.
  try {
    const parsed = JSON.parse(raw);
    const candidates = harvestStrings(parsed, 3).filter((one) => /[a-z]/i.test(one));
    return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
  } catch {
    return raw.length < 80 ? raw : null;
  }
};

export const geminiAdapter: SiteAdapter = {
  id: 'gemini-web',
  surface: 'gemini-web',
  hosting: 'cloud',
  version: 1,
  matches: ['https://gemini.google.com/*'],
  provider: 'google',

  shouldCapture(url, method) {
    return method.toUpperCase() === 'POST' && STREAM_ENDPOINT.test(url);
  },

  parseRequest(body, headers, url): ParsedRequest | null {
    const decoded = decodeEnvelope(body);
    if (decoded === null) return null;

    const model = readModelHeader(headers);
    const strings = harvestStrings(decoded);

    return {
      conversationId: CONVERSATION_IN_URL.exec(url)?.[1] ?? null,
      modelRaw: model,
      modelSource: model ? 'header' : 'unknown',
      // The longest string in the envelope is the prompt often enough to be
      // useful and not always, which is why these counts are estimates.
      inputText: strings.sort((a, b) => b.length - a.length)[0] ?? '',
    };
  },

  parseStream(body): ParsedStream | null {
    // The response is a sequence of length-prefixed JSON arrays.
    const chunks: unknown[] = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('[')) continue;
      try {
        chunks.push(JSON.parse(trimmed));
      } catch {
        // A length prefix or a partial chunk.
      }
    }
    if (chunks.length === 0) return null;

    const strings = chunks.flatMap((chunk) => harvestStrings(chunk, 20));
    const output = strings.sort((a, b) => b.length - a.length)[0] ?? '';

    return {
      modelRaw: null,
      modelSource: 'unknown',
      outputText: output,
      // Gemini can think without saying how much, and the response gives us no
      // count at all, so this is always a lower bound.
      thinkingUndisclosed: true,
    };
  },

  conversationIdFromUrl(url) {
    return CONVERSATION_IN_URL.exec(url)?.[1] ?? null;
  },

  readSelectedModel(document) {
    const picker =
      document.querySelector('[data-test-id="bard-mode-menu-button"]') ??
      document.querySelector('bard-mode-switcher button');
    const text = picker?.textContent?.trim();
    return text && text.length > 0 && text.length < 60 ? text : null;
  },

  findComposer(document) {
    return (
      document.querySelector<HTMLElement>('rich-textarea div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  },

  readDraft(document) {
    return geminiAdapter.findComposer(document)?.textContent ?? '';
  },

  healthProbe(document): AdapterHealth {
    const hasComposer = geminiAdapter.findComposer(document) !== null;
    const hasPicker = geminiAdapter.readSelectedModel(document) !== null;
    if (hasComposer && hasPicker) return 'ok';
    if (hasComposer) return 'degraded';
    return 'unsupported';
  },
};
