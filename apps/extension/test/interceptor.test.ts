import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EVENT_NAME, installInterceptor } from '../src/lib/interceptor.js';
import type { InterceptedExchange } from '../src/lib/interceptor.js';

/**
 * The interceptor is the part of this extension that has to be beyond argument.
 * It runs in the page's own world, so these tests are less about features and
 * more about what it must never do: consume the page's response, change a
 * request, or fire on traffic nobody asked it to look at.
 */

interface FakeWindow {
  fetch: typeof fetch;
  XMLHttpRequest: typeof XMLHttpRequest;
  dispatchEvent(event: Event): boolean;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

let fakeWindow: FakeWindow;
let seen: Array<{ nonce: string; exchange: InterceptedExchange }>;
let restore: () => void;
let served: string[];

const CONFIG = {
  nonce: 'test-nonce',
  patterns: ['/api/organizations/[^/]+/chat_conversations/[^/]+/completion'],
  maxBodyBytes: 1024 * 1024,
};

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
};

beforeEach(() => {
  seen = [];
  served = [];
  const listeners: Array<(event: Event) => void> = [];

  fakeWindow = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      served.push(url);
      return new Response(streamOf(['data: {"a":1}\n', 'data: {"b":2}\n']), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }) as typeof fetch,
    XMLHttpRequest: class {} as unknown as typeof XMLHttpRequest,
    dispatchEvent(event: Event) {
      for (const listener of listeners) listener(event);
      return true;
    },
    addEventListener(_type: string, listener: (event: Event) => void) {
      listeners.push(listener);
    },
  };

  (globalThis as unknown as { window: FakeWindow }).window = fakeWindow;

  /*
   * The listener holds this test's array directly rather than reading the
   * shared variable. A stream from the previous test can still be draining
   * when this one starts, and without the capture its late publish landed in
   * the new array and made a passing test fail.
   */
  const mine = seen;
  fakeWindow.addEventListener(EVENT_NAME, (event) => {
    mine.push((event as CustomEvent).detail);
  });

  restore = installInterceptor(CONFIG);
});

afterEach(() => {
  restore();
  delete (globalThis as unknown as { window?: FakeWindow }).window;
});

/**
 * Waits for the publish rather than sleeping for a guessed interval.
 *
 * A fixed sleep passed on its own and failed in the full run, which is the
 * definition of a flaky test.
 */
const settle = async (expected = 0): Promise<void> => {
  const deadline = Date.now() + 2000;
  while (seen.length < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  // A little longer, so a test asserting nothing happened gives it a chance to.
  if (expected === 0) await new Promise((resolve) => setTimeout(resolve, 50));
};

describe('what it reads', () => {
  it('publishes the exchange for an address an adapter asked about', async () => {
    const response = await fakeWindow.fetch(
      'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
      { method: 'POST', body: '{"prompt":"hello"}' },
    );
    await response.text();
    await settle(1);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.nonce).toBe('test-nonce');
    expect(seen[0]?.exchange.requestBody).toBe('{"prompt":"hello"}');
    expect(seen[0]?.exchange.responseBody).toContain('"a":1');
    expect(seen[0]?.exchange.responseBody).toContain('"b":2');
  });

  it('leaves the page its own response, whole', async () => {
    const response = await fakeWindow.fetch(
      'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
      { method: 'POST', body: '{}' },
    );
    // The page reads its body after we have read ours. If we had consumed the
    // stream instead of teeing it, this would be empty and the site would break.
    const text = await response.text();
    expect(text).toContain('"a":1');
    expect(text).toContain('"b":2');
  });

  it('does not fire on an address nobody asked about', async () => {
    await (await fakeWindow.fetch('https://claude.ai/api/account', { method: 'POST', body: '{}' })).text();
    await settle();
    expect(seen).toHaveLength(0);
  });

  it('does not fire on anything that is not a post', async () => {
    await (
      await fakeWindow.fetch(
        'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
      )
    ).text();
    await settle();
    expect(seen).toHaveLength(0);
  });

  it('passes every request through untouched, watched or not', async () => {
    await fakeWindow.fetch('https://claude.ai/api/account', { method: 'POST', body: '{}' });
    await fakeWindow.fetch(
      'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
      { method: 'POST', body: '{}' },
    );
    expect(served).toEqual([
      'https://claude.ai/api/account',
      'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
    ]);
    // Let the watched one finish draining, rather than leaving it to land in
    // whatever runs next.
    await settle(1);
  });
});

describe('what it refuses to carry', () => {
  it('copies only the headers an adapter needs to name a model', async () => {
    await (
      await fakeWindow.fetch(
        'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
        {
          method: 'POST',
          body: '{}',
          headers: {
            cookie: 'session=secret',
            authorization: 'Bearer secret',
            'x-api-key': 'secret',
            'content-type': 'application/json',
            'x-goog-ext-525001261-jspb': '["gemini-2.5-pro"]',
          },
        },
      )
    ).text();
    await settle(1);

    const headers = seen[0]?.exchange.requestHeaders ?? {};
    expect(Object.keys(headers).sort()).toEqual(['content-type', 'x-goog-ext-525001261-jspb']);
    expect(JSON.stringify(headers)).not.toContain('secret');
  });

  it('drops a body too large to hold rather than filling memory with it', async () => {
    const tiny = installInterceptor({ ...CONFIG, maxBodyBytes: 4 });
    await (
      await fakeWindow.fetch(
        'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
        { method: 'POST', body: '{}' },
      )
    ).text();
    await settle(1);
    expect(seen[seen.length - 1]?.exchange.responseBody).toBe('');
    tiny();
  });
});

describe('putting things back', () => {
  it('restores the original fetch, so nothing is left wrapped', () => {
    const wrapped = fakeWindow.fetch;
    restore();
    expect(fakeWindow.fetch).not.toBe(wrapped);
    // Reinstall so the shared teardown has something to undo.
    restore = installInterceptor(CONFIG);
  });
});

describe('the nonce', () => {
  it('is on every event, so a page cannot forge a turn', async () => {
    await (
      await fakeWindow.fetch(
        'https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion',
        { method: 'POST', body: '{}' },
      )
    ).text();
    await settle(1);
    expect(seen.every((one) => one.nonce === 'test-nonce')).toBe(true);
  });
});
