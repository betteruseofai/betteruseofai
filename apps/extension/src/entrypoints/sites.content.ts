import { adapterFor } from '../adapters/index.js';
import type { CapturedTurn } from '../adapters/types.js';
import { EVENT_NAME, fillModelFromPage, parseExchange, turnFromExchange } from '../lib/bridge.js';

/**
 * The isolated content script.
 *
 * It injects the page-world interceptor, listens for what comes back,
 * validates it, and forwards a turn to the background. It also reports whether
 * the page still looks the way the adapter expects, so the popup can say "this
 * adapter needs an update" rather than showing a figure nobody should trust.
 *
 * One script for every site rather than one per site: the adapters differ, the
 * plumbing does not.
 */

export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',
  allFrames: false,

  async main(context) {
    const adapter = adapterFor(location.href);
    if (!adapter) return;

    /*
     * A fresh nonce per page load, from the browser's own generator. The page
     * can dispatch the same event we do, so without this it could invent
     * turns. Forging one would achieve nothing more interesting than a wrong
     * number in the user's own popup, but a wrong number is the thing this
     * whole project exists to avoid.
     */
    const nonce = crypto.randomUUID();
    let turnIndex = 0;

    window.addEventListener(EVENT_NAME, (event) => {
      const exchange = parseExchange((event as CustomEvent).detail, nonce);
      if (!exchange) return;
      if (!adapter.shouldCapture(exchange.url, exchange.method)) return;

      turnIndex += 1;
      const turn = turnFromExchange(exchange, adapter, turnIndex);
      if (!turn) return;

      send(fillModelFromPage(turn, adapter, document));
    });

    const send = (turn: CapturedTurn): void => {
      void browser.runtime
        .sendMessage({
          type: 'turn:captured',
          adapterId: adapter.id,
          adapterVersion: adapter.version,
          turn,
        })
        .catch(() => undefined);
    };

    // The patterns the interceptor watches come from the adapter, so the
    // page-world script has no list of its own to go stale.
    await injectScript('/interceptor.js', { keepInDom: false });
    window.dispatchEvent(
      new CustomEvent('buoa:configure', {
        detail: {
          nonce,
          patterns: capturePatternsFor(adapter.id),
          maxBodyBytes: 16 * 1024 * 1024,
        },
      }),
    );

    // Report health once the page has settled, and again if it changes.
    const report = (): void => {
      void browser.runtime
        .sendMessage({
          type: 'adapter:health',
          adapterId: adapter.id,
          adapterVersion: adapter.version,
          health: adapter.healthProbe(document),
        })
        .catch(() => undefined);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(report, 1500));
    } else {
      setTimeout(report, 1500);
    }

    context.onInvalidated(() => {
      // The extension was updated or disabled. Nothing to clean up beyond the
      // listener, which goes with the page.
    });
  },
});

/**
 * Address patterns worth watching, per adapter.
 *
 * Kept here rather than in the adapter so the page-world script receives a
 * plain list of strings and never imports anything.
 */
const capturePatternsFor = (adapterId: string): string[] => {
  switch (adapterId) {
    case 'claude-web':
      return ['/api/organizations/[^/]+/chat_conversations/[^/]+/completion'];
    case 'chatgpt-web':
      return ['/backend-api/(?:f/)?conversation$'];
    case 'gemini-web':
      return ['StreamGenerate'];
    case 'local-webui':
      return ['/api/(?:chat|generate)$', '/(?:v1|api/v0|api)/chat/completions$'];
    default:
      return [];
  }
};
