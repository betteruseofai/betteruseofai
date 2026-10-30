import { describe, expect, it } from 'vitest';

import { chatgptAdapter, claudeAdapter, geminiAdapter } from '../src/adapters/index.js';
import { alreadyCounted, createFallback, replacedBy } from '../src/lib/fallback.js';

/**
 * A stand-in page: a list of elements per selector, each with only the text
 * the fallback reads. No DOM library, because none is installed here.
 */
const page = (elements: Record<string, string[]>) =>
  ({
    querySelectorAll: (selector: string) =>
      (elements[selector] ?? []).map((text) => ({ textContent: text })),
  }) as unknown as Document;

const chat = (pairs: Array<[string, string]>, answering = false) =>
  page({
    '[data-message-author-role="user"]': pairs.map(([question]) => question),
    '[data-message-author-role="assistant"]': pairs.map(([, answer]) => answer),
    '[data-testid="stop-button"]': answering ? ['stop'] : [],
  });

const AT = '2026-10-30T10:00:00.000Z';
const URL_ONE = 'https://chatgpt.com/c/0123456789abcdef0123';
const URL_TWO = 'https://chatgpt.com/c/fedcba9876543210fedc';

describe('the page fallback', () => {
  it('counts an answer that arrived after a send the network missed', () => {
    const fallback = createFallback(chatgptAdapter, 'load-1', chat([['old question', 'old answer']]), URL_ONE);
    fallback.sent();
    const turn = fallback.check(
      chat([
        ['old question', 'old answer'],
        ['Name three rivers', 'The Danube, the Rhine and the Seine.'],
      ]),
      URL_ONE,
      AT,
    );
    expect(turn?.inputText).toBe('Name three rivers');
    expect(turn?.outputText).toBe('The Danube, the Rhine and the Seine.');
    expect(turn?.key).toMatch(/:load-1:page1$/);
    expect(turn?.thinkingUndisclosed).toBe(true);
  });

  it('never counts history that was on the page already', () => {
    const history = chat([
      ['one', 'first'],
      ['two', 'second'],
    ]);
    const fallback = createFallback(chatgptAdapter, 'load-1', history, URL_ONE);
    fallback.sent();
    expect(fallback.check(history, URL_ONE, AT)).toBeNull();
  });

  it('counts nothing without a send, and nothing the network already counted', () => {
    const before = chat([]);
    const after = chat([['q', 'a']]);

    const unsent = createFallback(chatgptAdapter, 'load-1', before, URL_ONE);
    expect(unsent.check(after, URL_ONE, AT)).toBeNull();

    const captured = createFallback(chatgptAdapter, 'load-1', before, URL_ONE);
    captured.sent();
    captured.captured();
    expect(captured.check(after, URL_ONE, AT)).toBeNull();
  });

  it('waits for an answer that is still being written', () => {
    const fallback = createFallback(chatgptAdapter, 'load-1', chat([]), URL_ONE);
    fallback.sent();
    expect(fallback.check(chat([['q', 'half an ans']], true), URL_ONE, AT)).toBeNull();
    expect(fallback.check(chat([['q', 'half an answer, now whole']]), URL_ONE, AT)?.outputText).toBe(
      'half an answer, now whole',
    );
  });

  it('treats a move to another conversation as history, not as a turn', () => {
    const fallback = createFallback(chatgptAdapter, 'load-1', chat([]), URL_ONE);
    fallback.sent();
    const elsewhere = chat([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(fallback.check(elsewhere, URL_TWO, AT)).toBeNull();
  });

  it('follows a new conversation as it gets its address after the first send', () => {
    const fallback = createFallback(chatgptAdapter, 'load-1', chat([]), 'https://chatgpt.com/');
    fallback.sent();
    expect(fallback.check(chat([['first', 'reply']]), URL_ONE, AT)?.conversationId).toBe(
      '0123456789abcdef0123',
    );
  });

  it('reads each site by its own markup', () => {
    const claude = claudeAdapter.readLastExchange(
      page({
        '[data-testid="user-message"]': ['hello'],
        '[data-is-streaming]': ['hi there'],
        '[data-is-streaming="true"]': [],
      }),
    );
    expect(claude).toEqual({ answers: 1, answering: false, input: 'hello', output: 'hi there' });

    const gemini = geminiAdapter.readLastExchange(
      page({ 'user-query': ['hello'], 'model-response': ['hi there'], 'button[aria-label*="Stop"]': ['stop'] }),
    );
    expect(gemini?.answering).toBe(true);
  });
});

describe('one turn, read twice', () => {
  const network = {
    id: 'claude-web:conv-1:load:1',
    event: { surface: 'claude-web', conversationId: 'conv-1', timestamp: '2026-10-30T10:00:00.000Z' },
  };
  const pageTurn = {
    id: 'conv-1:load:page1',
    event: { surface: 'claude-web', conversationId: 'conv-1', timestamp: '2026-10-30T10:00:20.000Z' },
  };

  it('drops a page turn beside a stored network turn', () => {
    expect(alreadyCounted([network] as never, { id: pageTurn.id, ...pageTurn.event })).toBe(true);
    // A minute and more apart, they are two turns.
    expect(
      alreadyCounted([network] as never, { id: pageTurn.id, ...pageTurn.event, timestamp: '2026-10-30T10:02:00.000Z' }),
    ).toBe(false);
  });

  it('lets a late network turn replace the page turn it duplicates', () => {
    expect(replacedBy([pageTurn] as never, network.event)).toEqual(['conv-1:load:page1']);
    // Never another network turn.
    expect(replacedBy([network] as never, pageTurn.event)).toEqual([]);
  });
});
