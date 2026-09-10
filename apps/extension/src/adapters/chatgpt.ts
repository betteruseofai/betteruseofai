import type { AdapterHealth, ParsedRequest, ParsedStream, SiteAdapter } from './types.js';
import { sseEvents } from './claude.js';

/**
 * chatgpt.com
 *
 * The one thing that matters here: the model in the request is not
 * necessarily the model that answered. ChatGPT routes automatically, so a
 * request naming one model can be served by another, and the only honest
 * source is `metadata.resolved_model_slug` in the stream.
 *
 * We read the request slug as a fallback, and we record which of the two the
 * figure rests on, because a routed turn priced against the requested model is
 * simply a wrong number.
 *
 * The stream is delta encoded, so the text arrives as patch operations rather
 * than as whole messages.
 */

const CONVERSATION_ENDPOINT = /\/backend-api\/(?:f\/)?conversation$/;
const CONVERSATION_IN_URL = /\/c\/([0-9a-f-]{16,})/i;

const walkForText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(walkForText).join('');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record['parts'])) return (record['parts'] as unknown[]).map(walkForText).join('');
    if (record['content'] !== undefined) return walkForText(record['content']);
  }
  return '';
};

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt-web',
  surface: 'chatgpt-web',
  hosting: 'cloud',
  version: 1,
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  provider: 'openai',

  shouldCapture(url, method) {
    return method.toUpperCase() === 'POST' && CONVERSATION_ENDPOINT.test(new URL(url, 'https://chatgpt.com').pathname);
  },

  parseRequest(body, _headers, url): ParsedRequest | null {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }

    const conversationId =
      typeof parsed['conversation_id'] === 'string'
        ? parsed['conversation_id']
        : (CONVERSATION_IN_URL.exec(url)?.[1] ?? null);

    const requested = typeof parsed['model'] === 'string' ? parsed['model'] : null;
    const messages = Array.isArray(parsed['messages']) ? (parsed['messages'] as unknown[]) : [];

    return {
      conversationId,
      modelRaw: requested,
      // Deliberately marked as the request rather than the answer. Auto routing
      // means this can be superseded by resolved_model_slug in the stream.
      modelSource: requested ? 'request' : 'unknown',
      inputText: messages.map(walkForText).join('\n'),
    };
  },

  parseStream(body): ParsedStream | null {
    const events = sseEvents(body);
    if (events.length === 0) return null;

    let resolved: string | null = null;
    let requested: string | null = null;
    let output = '';
    let reasoningSeen = false;
    const reported: NonNullable<ParsedStream['reportedTokens']> = {};

    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      const record = event as Record<string, unknown>;

      // Delta encoded: the interesting payload can sit under v, or under a
      // patch operation, or in a whole message.
      const candidates: unknown[] = [record, record['v'], record['message'], record['o']];
      if (Array.isArray(record['v'])) candidates.push(...(record['v'] as unknown[]));

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') continue;
        const node = candidate as Record<string, unknown>;

        const metadata = node['metadata'] as Record<string, unknown> | undefined;
        if (metadata && typeof metadata['resolved_model_slug'] === 'string') {
          resolved = metadata['resolved_model_slug'];
        }
        if (typeof node['model_slug'] === 'string') requested = node['model_slug'];

        const author = node['author'] as Record<string, unknown> | undefined;
        if (author?.['role'] === 'tool' || node['recipient'] === 'all') {
          // Tool traffic, not the visible answer.
        }
        if (node['content'] !== undefined) {
          const contentType = (node['content'] as Record<string, unknown>)['content_type'];
          if (contentType === 'thoughts' || contentType === 'reasoning_recap') reasoningSeen = true;
          else output += walkForText(node['content']);
        }

        const usage = node['usage'] as Record<string, unknown> | undefined;
        if (usage) {
          if (typeof usage['prompt_tokens'] === 'number') reported.input = usage['prompt_tokens'];
          if (typeof usage['completion_tokens'] === 'number') {
            reported.output = usage['completion_tokens'];
          }
        }
      }

      if (typeof record['v'] === 'string' && record['p'] === undefined) output += record['v'];
      if (typeof record['v'] === 'string' && typeof record['p'] === 'string' && record['p'].includes('/content/parts/')) {
        output += record['v'];
      }
    }

    const modelRaw = resolved ?? requested;
    return {
      modelRaw,
      // This is the whole point of the adapter: say whether the figure rests on
      // the model that actually answered or on the one that was asked for.
      modelSource: resolved ? 'response' : requested ? 'request' : 'unknown',
      outputText: output,
      ...(Object.keys(reported).length > 0 ? { reportedTokens: reported } : {}),
      thinkingUndisclosed: reasoningSeen && reported.thinking === undefined,
    };
  },

  conversationIdFromUrl(url) {
    return CONVERSATION_IN_URL.exec(url)?.[1] ?? null;
  },

  readSelectedModel(document) {
    const picker = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
    const text = picker?.textContent?.trim();
    return text && text.length > 0 && text.length < 60 ? text : null;
  },

  findComposer(document) {
    return (
      document.querySelector<HTMLElement>('#prompt-textarea') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  },

  readDraft(document) {
    return chatgptAdapter.findComposer(document)?.textContent ?? '';
  },

  healthProbe(document): AdapterHealth {
    const hasComposer = chatgptAdapter.findComposer(document) !== null;
    const hasPicker =
      document.querySelector('[data-testid="model-switcher-dropdown-button"]') !== null;
    if (hasComposer && hasPicker) return 'ok';
    if (hasComposer) return 'degraded';
    return 'unsupported';
  },
};
