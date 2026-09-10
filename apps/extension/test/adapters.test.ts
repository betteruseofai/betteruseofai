import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ADAPTERS,
  adapterFor,
  chatgptAdapter,
  claudeAdapter,
  decodeEnvelope,
  geminiAdapter,
  localAdapter,
  sseEvents,
} from '../src/adapters/index.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'web');
const read = (...parts: string[]) => readFileSync(join(web, ...parts), 'utf8');

/**
 * Adapters are tested against recorded bodies, never against a live site. CI
 * must never contact claude.ai, chatgpt.com or anybody else, and a test that
 * did would be flaky and rude in equal measure.
 */

describe('choosing an adapter', () => {
  it.each([
    ['https://claude.ai/chat/abc', 'claude-web'],
    ['https://chatgpt.com/c/abc', 'chatgpt-web'],
    ['https://chat.openai.com/c/abc', 'chatgpt-web'],
    ['https://gemini.google.com/app/abc', 'gemini-web'],
    ['http://localhost:11434/', 'local-webui'],
    ['http://127.0.0.1:3000/', 'local-webui'],
  ])('%s is handled by %s', (url, expected) => {
    expect(adapterFor(url)?.id).toBe(expected);
  });

  it('claims nothing it was not asked to claim', () => {
    for (const url of [
      'https://example.com/',
      'https://mail.google.com/',
      'https://google.com/search?q=claude.ai',
      'https://claude.ai.evil.example.com/',
    ]) {
      expect(adapterFor(url), url).toBeNull();
    }
  });

  it('never lets a cloud site fall through to the local adapter', () => {
    expect(adapterFor('https://claude.ai/chat/x')?.hosting).toBe('cloud');
    expect(ADAPTERS[ADAPTERS.length - 1]?.id).toBe('local-webui');
  });

  it('only ever captures a post', () => {
    for (const adapter of ADAPTERS) {
      const url = adapter.matches[0]?.replace('*', 'api/x') ?? '';
      expect(adapter.shouldCapture(url, 'GET'), adapter.id).toBe(false);
    }
  });
});

describe('claude.ai', () => {
  it('captures the completion endpoint and nothing else', () => {
    const completion =
      'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion';
    expect(claudeAdapter.shouldCapture(completion, 'POST')).toBe(true);
    expect(claudeAdapter.shouldCapture('https://claude.ai/api/account', 'POST')).toBe(false);
    expect(claudeAdapter.shouldCapture(completion, 'GET')).toBe(false);
  });

  it('reads the prompt and the conversation from the request', () => {
    const parsed = claudeAdapter.parseRequest(
      read('claude', 'request.json'),
      {},
      'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
    );
    expect(parsed?.conversationId).toBe('conv-1');
    expect(parsed?.modelRaw).toBe('claude-opus-5');
    expect(parsed?.modelSource).toBe('request');
    expect(parsed?.inputText).toContain('Rewrite this paragraph');
  });

  it('reads the model, the text and the disclosed thinking count from the stream', () => {
    const parsed = claudeAdapter.parseStream(read('claude', 'sse-with-model.txt'));
    expect(parsed?.modelRaw).toBe('claude-opus-5');
    expect(parsed?.modelSource).toBe('response');
    expect(parsed?.outputText).toContain('disagree by an order of magnitude');
    // The thinking text must not be counted as visible output.
    expect(parsed?.outputText).not.toContain('Considering the register');
    expect(parsed?.reportedTokens?.thinking).toBe(240);
    expect(parsed?.reportedTokens?.cachedRead).toBe(8100);
    expect(parsed?.thinkingUndisclosed).toBe(false);
  });

  it('flags a stream that thought without saying how much', () => {
    const parsed = claudeAdapter.parseStream(read('claude', 'sse-no-model.txt'));
    expect(parsed?.thinkingUndisclosed).toBe(true);
    expect(parsed?.reportedTokens?.thinking).toBeUndefined();
  });

  it('says it does not know the model rather than guessing at one', () => {
    const parsed = claudeAdapter.parseStream(read('claude', 'sse-no-model.txt'));
    expect(parsed?.modelRaw).toBeNull();
    expect(parsed?.modelSource).toBe('unknown');
  });

  it('returns null on a body it does not recognise', () => {
    expect(claudeAdapter.parseRequest('not json', {}, 'https://claude.ai/x')).toBeNull();
    expect(claudeAdapter.parseStream('nothing here')).toBeNull();
  });
});

describe('chatgpt.com', () => {
  it('prefers the model that answered over the one that was asked for', () => {
    const parsed = chatgptAdapter.parseStream(read('chatgpt', 'sse-routed.txt'));
    // The request said "auto". Pricing against that would be a wrong number.
    expect(parsed?.modelRaw).toBe('gpt-4o');
    expect(parsed?.modelSource).toBe('response');
  });

  it('records that the request slug is only the request', () => {
    const parsed = chatgptAdapter.parseRequest(
      read('chatgpt', 'request.json'),
      {},
      'https://chatgpt.com/backend-api/f/conversation',
    );
    expect(parsed?.modelRaw).toBe('auto');
    expect(parsed?.modelSource).toBe('request');
    expect(parsed?.inputText).toContain('Summarise the notes');
  });

  it('reassembles the delta encoded answer', () => {
    const parsed = chatgptAdapter.parseStream(read('chatgpt', 'sse-routed.txt'));
    expect(parsed?.outputText).toContain('The five points are as follows');
    expect(parsed?.outputText).toContain('in the order they appear');
  });

  it('flags a reasoning turn and keeps the thoughts out of the output', () => {
    const parsed = chatgptAdapter.parseStream(read('chatgpt', 'sse-reasoning.txt'));
    expect(parsed?.thinkingUndisclosed).toBe(true);
    expect(parsed?.outputText).toContain('The answer, after some thought');
    expect(parsed?.outputText).not.toContain('Working through it');
  });

  it('captures the conversation endpoint under either path', () => {
    expect(chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/conversation', 'POST')).toBe(true);
    expect(chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/f/conversation', 'POST')).toBe(true);
    expect(chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/me', 'POST')).toBe(false);
  });
});

describe('gemini.google.com', () => {
  it('unwraps the doubly encoded envelope', () => {
    const decoded = decodeEnvelope(read('gemini', 'request.txt'));
    expect(decoded).not.toBeNull();
    expect(JSON.stringify(decoded)).toContain('Translate the following sentence');
  });

  it('reads the model from the header, because the body has no field names', () => {
    const parsed = geminiAdapter.parseRequest(
      read('gemini', 'request.txt'),
      { 'x-goog-ext-525001261-jspb': '[1,null,null,null,"gemini-2.5-pro"]' },
      'https://gemini.google.com/app/abc123ef',
    );
    expect(parsed?.modelRaw).toBe('gemini-2.5-pro');
    expect(parsed?.modelSource).toBe('header');
    expect(parsed?.inputText).toContain('Translate the following sentence');
  });

  it('says unknown when the header is missing, rather than digging a guess out of the body', () => {
    const parsed = geminiAdapter.parseRequest(
      read('gemini', 'request.txt'),
      {},
      'https://gemini.google.com/app/abc123ef',
    );
    expect(parsed?.modelRaw).toBeNull();
    expect(parsed?.modelSource).toBe('unknown');
  });

  it('pulls the answer out of the nested response', () => {
    const parsed = geminiAdapter.parseStream(read('gemini', 'response.txt'));
    expect(parsed?.outputText).toContain('Voici la phrase traduite');
  });

  it('treats every turn as a lower bound, because no count is ever given', () => {
    expect(geminiAdapter.parseStream(read('gemini', 'response.txt'))?.thinkingUndisclosed).toBe(true);
  });
});

describe('a model on your own machine', () => {
  it('takes the exact counts Ollama reports rather than estimating', () => {
    const parsed = localAdapter.parseStream(read('local', 'ollama-response.txt'));
    expect(parsed?.modelRaw).toBe('llama3.1:8b');
    expect(parsed?.reportedTokens?.input).toBe(17);
    expect(parsed?.reportedTokens?.output).toBe(6);
    expect(parsed?.outputText).toBe('Canberra is the capital.');
  });

  it('takes the usage block from an OpenAI-compatible server', () => {
    const parsed = localAdapter.parseStream(read('local', 'lmstudio-response.txt'));
    expect(parsed?.reportedTokens?.input).toBe(19);
    expect(parsed?.reportedTokens?.output).toBe(4);
  });

  it('has nothing hidden to account for', () => {
    expect(localAdapter.parseStream(read('local', 'ollama-response.txt'))?.thinkingUndisclosed).toBe(
      false,
    );
  });

  it('reads the model tag from the request', () => {
    const parsed = localAdapter.parseRequest(
      read('local', 'ollama-request.json'),
      {},
      'http://localhost:11434/api/chat',
    );
    expect(parsed?.modelRaw).toBe('llama3.1:8b');
    expect(parsed?.inputText).toContain('capital of Australia');
  });

  it('captures both the Ollama and the OpenAI shaped endpoints', () => {
    expect(localAdapter.shouldCapture('http://localhost:11434/api/chat', 'POST')).toBe(true);
    expect(localAdapter.shouldCapture('http://localhost:1234/v1/chat/completions', 'POST')).toBe(true);
    expect(localAdapter.shouldCapture('http://localhost:3000/api/chat/completions', 'POST')).toBe(true);
    expect(localAdapter.shouldCapture('http://localhost:11434/api/tags', 'POST')).toBe(false);
  });
});

describe('reading a server-sent event stream', () => {
  it('ignores a half written trailing event rather than half counting it', () => {
    const body = 'data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c":';
    expect(sseEvents(body)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('ignores the done marker', () => {
    expect(sseEvents('data: [DONE]\n')).toEqual([]);
  });
});
