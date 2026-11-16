import { lastExchangeFrom } from './types.js';
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
/*
 * Signed out, the site uses another address and another format altogether: a
 * form-encoded request and a stream of JSON lines. Recorded on 16 November
 * 2026. Neither the request nor the stream names a model, so a signed-out
 * turn is priced as unknown unless the page says more.
 */
const ANON_ENDPOINT = /\/unauth-mweb\/conversation\/updates$/;
const CONVERSATION_IN_URL = /\/c\/([0-9a-f-]{16,})/i;

const parseAnonRequest = (body: string): ParsedRequest | null => {
  const form = new URLSearchParams(body);
  const prompt = form.get('prompt');
  if (prompt === null) return null;

  let conversationId: string | null = null;
  try {
    const state = JSON.parse(form.get('conversationState') ?? '{}') as Record<string, unknown>;
    if (typeof state['backendConversationId'] === 'string') conversationId = state['backendConversationId'];
  } catch {
    // No conversation yet, or a state we cannot read. The turn still counts.
  }

  let attached = false;
  for (const field of ['imageAttachments', 'pendingImageUploads']) {
    try {
      const list = JSON.parse(form.get(field) ?? '[]') as unknown;
      if (Array.isArray(list) && list.length > 0) attached = true;
    } catch {
      // Not a list we can read, so it is not evidence of an attachment.
    }
  }

  return {
    conversationId,
    modelRaw: null,
    modelSource: 'unknown',
    inputText: prompt,
    ...(attached ? { attachmentsUncounted: true } : {}),
  };
};

/**
 * The signed-out stream: one JSON object a line, each with a version and a
 * type. The answer arrives as numbered revisions of a message. A revision
 * carries plain markdown, or a rendered block with a markdown fallback that
 * restates the whole answer so far, so the fallback of the newest revision is
 * taken once and never added up.
 *
 * Plain markdown was empty in the one exchange recorded. Appending it under
 * mode "append" and replacing it under "replace" is what the field names say,
 * and has not been seen in a real stream.
 */
const parseAnonStream = (body: string): ParsedStream | null => {
  const messages = new Map<string, { markdown: string; fallback: string }>();
  let recognised = false;

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof record['version'] !== 'number' || typeof record['type'] !== 'string') continue;
    recognised = true;
    if (record['type'] !== 'content' || typeof record['messageId'] !== 'string') continue;

    const held = messages.get(record['messageId']) ?? { markdown: '', fallback: '' };
    if (typeof record['markdown'] === 'string') {
      held.markdown = record['mode'] === 'replace' ? record['markdown'] : held.markdown + record['markdown'];
    }
    const block = record['dil'] as Record<string, unknown> | undefined;
    if (block && typeof block['fallbackMarkdown'] === 'string') held.fallback = block['fallbackMarkdown'];
    else if (record['mode'] === 'replace') held.fallback = '';
    messages.set(record['messageId'], held);
  }

  if (!recognised) return null;
  return {
    modelRaw: null,
    modelSource: 'unknown',
    outputText: [...messages.values()].map((one) => one.markdown + one.fallback).join('\n'),
    // Nothing in this stream says whether the model reasoned first, and
    // nothing says it did not.
    thinkingUndisclosed: false,
  };
};

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
  version: 2,
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  provider: 'openai',

  shouldCapture(url, method) {
    if (method.toUpperCase() !== 'POST') return false;
    const path = new URL(url, 'https://chatgpt.com').pathname;
    return CONVERSATION_ENDPOINT.test(path) || ANON_ENDPOINT.test(path);
  },

  parseRequest(body, _headers, url): ParsedRequest | null {
    if (ANON_ENDPOINT.test(new URL(url, 'https://chatgpt.com').pathname)) return parseAnonRequest(body);

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
    // The signed-out stream is JSON lines with no "data:" in front of them.
    if (/^\s*\{/.test(body)) return parseAnonStream(body);

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
      // Signed out, and on narrow windows, the composer is a plain textarea.
      document.querySelector<HTMLElement>('textarea#mobile-composer-prompt') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>('form textarea')
    );
  },

  readDraft(document) {
    const composer = chatgptAdapter.findComposer(document);
    // A textarea keeps what is typed in value; its text content stays empty.
    if (composer?.tagName === 'TEXTAREA') return (composer as HTMLTextAreaElement).value;
    return composer?.textContent ?? '';
  },

  readLastExchange(document) {
    // The role attribute has outlasted every redesign so far. The stop
    // button is only there while an answer is being written.
    return lastExchangeFrom(document, {
      question: '[data-message-author-role="user"]',
      answer: '[data-message-author-role="assistant"]',
      answering: '[data-testid="stop-button"]',
    });
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
