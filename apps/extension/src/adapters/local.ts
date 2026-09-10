import type { AdapterHealth, ParsedRequest, ParsedStream, SiteAdapter } from './types.js';

/**
 * Local model front ends: Ollama, LM Studio, Open WebUI, Jan.
 *
 * The happy case. These report exact token counts, so nothing here is
 * estimated: Ollama gives prompt_eval_count and eval_count, and the OpenAI
 * compatible endpoints give a usage block. Where the site tells us the truth
 * we take it and mark the counts as reported rather than estimated.
 *
 * The model name arrives as a tag such as llama3.1:8b, which the dataset
 * resolves by alias. An unrecognised tag stays unrecognised: the parameter
 * count is guessable from the tag, but a guessed parameter count feeding a
 * parametric formula is two guesses stacked, and that is a number nobody
 * should quote.
 */

const OLLAMA_CHAT = /\/api\/(?:chat|generate)$/;
const OPENAI_CHAT = /\/(?:v1|api\/v0|api)\/chat\/completions$/;

export const localAdapter: SiteAdapter = {
  id: 'local-webui',
  surface: 'local-webui',
  hosting: 'local',
  version: 1,
  matches: [
    'http://localhost/*',
    'http://127.0.0.1/*',
    'http://localhost:*/*',
    'http://127.0.0.1:*/*',
  ],
  provider: 'openai',

  shouldCapture(url, method) {
    if (method.toUpperCase() !== 'POST') return false;
    const path = new URL(url, 'http://localhost').pathname;
    return OLLAMA_CHAT.test(path) || OPENAI_CHAT.test(path);
  },

  parseRequest(body, _headers, url): ParsedRequest | null {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }

    const model = typeof parsed['model'] === 'string' ? parsed['model'] : null;
    const messages = Array.isArray(parsed['messages'])
      ? (parsed['messages'] as Array<Record<string, unknown>>)
          .map((one) => (typeof one['content'] === 'string' ? one['content'] : ''))
          .join('\n')
      : typeof parsed['prompt'] === 'string'
        ? parsed['prompt']
        : '';

    return {
      conversationId: new URL(url, 'http://localhost').port || 'local',
      modelRaw: model,
      modelSource: model ? 'request' : 'unknown',
      inputText: messages,
    };
  },

  parseStream(body): ParsedStream | null {
    const reported: NonNullable<ParsedStream['reportedTokens']> = {};
    let model: string | null = null;
    let output = '';

    const consider = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;

      if (typeof record['model'] === 'string') model = record['model'];

      // Ollama: exact counts on the final chunk.
      if (typeof record['prompt_eval_count'] === 'number') {
        reported.input = record['prompt_eval_count'];
      }
      if (typeof record['eval_count'] === 'number') reported.output = record['eval_count'];

      // OpenAI-compatible: a usage block.
      const usage = record['usage'] as Record<string, unknown> | undefined;
      if (usage) {
        if (typeof usage['prompt_tokens'] === 'number') reported.input = usage['prompt_tokens'];
        if (typeof usage['completion_tokens'] === 'number') {
          reported.output = usage['completion_tokens'];
        }
      }

      const message = record['message'] as Record<string, unknown> | undefined;
      if (message && typeof message['content'] === 'string') output += message['content'];
      if (typeof record['response'] === 'string') output += record['response'];

      const choices = record['choices'] as Array<Record<string, unknown>> | undefined;
      for (const choice of choices ?? []) {
        const delta = (choice['delta'] ?? choice['message']) as Record<string, unknown> | undefined;
        if (delta && typeof delta['content'] === 'string') output += delta['content'];
      }
    };

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed === 'data: [DONE]') continue;
      const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      try {
        consider(JSON.parse(payload));
      } catch {
        // Not a JSON line. These servers interleave plain text sometimes.
      }
    }

    if (model === null && output === '' && Object.keys(reported).length === 0) return null;

    return {
      modelRaw: model,
      modelSource: model ? 'response' : 'unknown',
      outputText: output,
      ...(Object.keys(reported).length > 0 ? { reportedTokens: reported } : {}),
      // Local models that think report it in the visible output, so there is
      // nothing hidden to account for.
      thinkingUndisclosed: false,
    };
  },

  conversationIdFromUrl(url) {
    try {
      return new URL(url).port || 'local';
    } catch {
      return null;
    }
  },

  readSelectedModel() {
    // Every one of these front ends puts the model somewhere different. The
    // request body always has it, so guessing from the page is not worth the
    // chance of getting it wrong.
    return null;
  },

  findComposer(document) {
    return (
      document.querySelector<HTMLElement>('#chat-input') ??
      document.querySelector<HTMLElement>('textarea') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  },

  readDraft(document) {
    const composer = localAdapter.findComposer(document);
    if (composer instanceof HTMLTextAreaElement) return composer.value;
    return composer?.textContent ?? '';
  },

  healthProbe(document): AdapterHealth {
    return localAdapter.findComposer(document) !== null ? 'ok' : 'degraded';
  },
};
