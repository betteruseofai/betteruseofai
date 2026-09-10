import type { AdapterHealth, ParsedRequest, ParsedStream, SiteAdapter } from './types.js';

/**
 * claude.ai
 *
 * The endpoint is a completion POST under the organisation and conversation
 * ids, and the response is server-sent events. Two things about it matter.
 *
 * The model is sometimes absent from the completion body, so the picker in the
 * page is the fallback and the result records which of the two it came from.
 * Fetching the conversation afterwards does not help: that only returns the
 * model currently selected, so a conversation where the model was switched
 * loses its history. Capture has to happen at send time.
 *
 * And Claude can think without disclosing the count. When the stream carries
 * no thinking figure we set thinkingUndisclosed, and the engine turns that
 * into a range from zero with a flag rather than into nothing.
 */

const COMPLETION = /\/api\/organizations\/[^/]+\/chat_conversations\/([^/]+)\/completion/;
const CONVERSATION_IN_URL = /\/chat\/([0-9a-f-]{16,})/i;

/** Pulls the data lines out of a server-sent event stream. */
export const sseEvents = (body: string): unknown[] => {
  const events: unknown[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '' || payload === '[DONE]') continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // A partial line at the end of a stream we cut short. Skipping it is
      // right: half an event is not an event.
    }
  }
  return events;
};

const textOf = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['text'] === 'string') return record['text'];
    if (record['content'] !== undefined) return textOf(record['content']);
  }
  return '';
};

export const claudeAdapter: SiteAdapter = {
  id: 'claude-web',
  surface: 'claude-web',
  hosting: 'cloud',
  version: 1,
  matches: ['https://claude.ai/*'],
  provider: 'anthropic',

  shouldCapture(url, method) {
    return method.toUpperCase() === 'POST' && COMPLETION.test(url);
  },

  parseRequest(body, _headers, url): ParsedRequest | null {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }

    const conversationId = COMPLETION.exec(url)?.[1] ?? null;
    const model = typeof parsed['model'] === 'string' ? parsed['model'] : null;

    const prompt = typeof parsed['prompt'] === 'string' ? parsed['prompt'] : '';
    const attachments = Array.isArray(parsed['attachments'])
      ? (parsed['attachments'] as unknown[]).map(textOf).join('\n')
      : '';

    return {
      conversationId,
      modelRaw: model,
      // Absent from the body more often than you would expect, and the caller
      // falls back to the picker when this says unknown.
      modelSource: model ? 'request' : 'unknown',
      inputText: [prompt, attachments].filter(Boolean).join('\n'),
    };
  },

  parseStream(body): ParsedStream | null {
    const events = sseEvents(body);
    if (events.length === 0) return null;

    let modelRaw: string | null = null;
    let output = '';
    let thinkingSeen = false;
    let thinkingCount: number | null = null;
    const reported: NonNullable<ParsedStream['reportedTokens']> = {};

    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      const record = event as Record<string, unknown>;

      const message = record['message'] as Record<string, unknown> | undefined;
      if (typeof record['model'] === 'string') modelRaw = record['model'];
      else if (message && typeof message['model'] === 'string') modelRaw = message['model'];

      const delta = record['delta'] as Record<string, unknown> | undefined;
      if (delta) {
        if (delta['type'] === 'thinking_delta') thinkingSeen = true;
        else output += textOf(delta);
      }
      if (record['type'] === 'completion' && typeof record['completion'] === 'string') {
        output += record['completion'];
      }

      const block = record['content_block'] as Record<string, unknown> | undefined;
      if (block?.['type'] === 'thinking') thinkingSeen = true;

      const usage = (message?.['usage'] ?? record['usage']) as Record<string, unknown> | undefined;
      if (usage) {
        if (typeof usage['input_tokens'] === 'number') reported.input = usage['input_tokens'];
        if (typeof usage['output_tokens'] === 'number') reported.output = usage['output_tokens'];
        if (typeof usage['cache_read_input_tokens'] === 'number') {
          reported.cachedRead = usage['cache_read_input_tokens'];
        }
        const details = usage['output_tokens_details'] as Record<string, unknown> | undefined;
        if (details && typeof details['thinking_tokens'] === 'number') {
          thinkingCount = details['thinking_tokens'];
        }
      }
    }

    if (thinkingCount !== null) reported.thinking = thinkingCount;

    return {
      modelRaw,
      modelSource: modelRaw ? 'response' : 'unknown',
      outputText: output,
      ...(Object.keys(reported).length > 0 ? { reportedTokens: reported } : {}),
      // Thinking happened and nobody said how much. That is a lower bound, not
      // a zero, and the flag is what makes the interface say so.
      thinkingUndisclosed: thinkingSeen && thinkingCount === null,
    };
  },

  conversationIdFromUrl(url) {
    return CONVERSATION_IN_URL.exec(url)?.[1] ?? null;
  },

  readSelectedModel(document) {
    const picker = document.querySelector('[data-testid="model-selector-dropdown"]');
    const text = picker?.textContent?.trim();
    return text && text.length > 0 && text.length < 60 ? text : null;
  },

  findComposer(document) {
    return document.querySelector<HTMLElement>('div[contenteditable="true"][enterkeyhint]')
      ?? document.querySelector<HTMLElement>('div.ProseMirror[contenteditable="true"]');
  },

  readDraft(document) {
    return claudeAdapter.findComposer(document)?.textContent ?? '';
  },

  healthProbe(document): AdapterHealth {
    const hasComposer = claudeAdapter.findComposer(document) !== null;
    const hasPicker = document.querySelector('[data-testid="model-selector-dropdown"]') !== null;
    if (hasComposer && hasPicker) return 'ok';
    // The composer alone is enough to count a turn; without the picker we
    // simply cannot name the model when the body omits it.
    if (hasComposer) return 'degraded';
    return 'unsupported';
  },
};
