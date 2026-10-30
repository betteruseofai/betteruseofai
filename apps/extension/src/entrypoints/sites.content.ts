import { removeHint, showHint } from '@betteruseofai/ui-hint';

import { adapterFor } from '../adapters/index.js';
import type { CapturedTurn } from '../adapters/types.js';
import { EVENT_NAME, fillModelFromPage, parseExchange, turnFromExchange } from '../lib/bridge.js';
import { createFallback } from '../lib/fallback.js';
import type { Fallback } from '../lib/fallback.js';
import { looksSignedOut } from '../lib/health.js';

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
    // Kept apart from the nonce, which guards the page boundary and stays private.
    const loadId = crypto.randomUUID();

    // Created once the page has a body; until then nothing can have been sent.
    let fallback: Fallback | null = null;

    window.addEventListener(EVENT_NAME, (event) => {
      const exchange = parseExchange((event as CustomEvent).detail, nonce);
      if (!exchange) return;
      if (!adapter.shouldCapture(exchange.url, exchange.method)) return;

      turnIndex += 1;
      const turn = turnFromExchange(exchange, adapter, turnIndex, loadId);
      if (!turn) return;

      fallback?.captured();
      send(fillModelFromPage(turn, adapter, document));
    });

    const send = (turn: CapturedTurn, type: 'turn:captured' | 'turn:dom' = 'turn:captured'): void => {
      void browser.runtime
        .sendMessage({
          type,
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
      new CustomEvent('buai:configure', {
        detail: {
          nonce,
          patterns: capturePatternsFor(adapter.id),
          maxBodyBytes: 16 * 1024 * 1024,
        },
      }),
    );

    /*
     * Report health once the page has settled, and again whenever it changes.
     * These are single-page apps: the composer comes and goes as people move
     * between a conversation, settings and the sign-in page, so one look a
     * second and a half after load was often a look at the wrong screen. Only
     * a change is sent, so a busy page costs one probe every two seconds.
     */
    let reported: string | null = null;
    const report = (): void => {
      const probed = adapter.healthProbe(document);
      const health = probed !== 'ok' && looksSignedOut(location.pathname, document) ? 'signed-out' : probed;
      if (health === reported) return;
      reported = health;
      void browser.runtime
        .sendMessage({
          type: 'adapter:health',
          adapterId: adapter.id,
          adapterVersion: adapter.version,
          health,
        })
        .catch(() => undefined);
    };

    let pending: ReturnType<typeof setTimeout> | undefined;
    const reportSoon = (delay: number): void => {
      clearTimeout(pending);
      pending = setTimeout(report, delay);
    };

    /*
     * The page fallback (lib/fallback.ts). A send is Enter in the composer or
     * a press of a send button. The page is read once it has been quiet for
     * five seconds, long enough that a model pausing to think is not taken
     * for one that has finished.
     */
    let settled: ReturnType<typeof setTimeout> | undefined;
    const checkSoon = (): void => {
      clearTimeout(settled);
      settled = setTimeout(() => {
        const turn = fallback?.check(document, location.href, new Date().toISOString());
        if (turn) send(fillModelFromPage(turn, adapter, document), 'turn:dom');
      }, 5000);
    };
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
        const composer = adapter.findComposer(document);
        if (!composer || !composer.contains(event.target as Node)) return;
        if (adapter.readDraft(document).trim() !== '') fallback?.sent();
      },
      { capture: true },
    );
    document.addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element | null)?.closest?.('button');
        const name = `${button?.getAttribute('aria-label') ?? ''} ${button?.getAttribute('data-testid') ?? ''}`;
        if (button && /send/i.test(name)) fallback?.sent();
      },
      { capture: true },
    );

    const watch = (): void => {
      fallback = createFallback(adapter, loadId, document, location.href);
      reportSoon(1500);
      new MutationObserver(() => {
        reportSoon(2000);
        checkSoon();
      }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watch);
    } else {
      watch();
    }

    // ------------------------------------------------------- the composer hint

    /*
     * Cooldowns per rule, remembered across pages. Saying no to a nudge has to
     * mean something, or the feature is an irritation rather than a help.
     */
    let cooldowns: Record<string, number> = {};
    void browser.storage.local.get(['hintCooldowns']).then((stored) => {
      cooldowns = (stored['hintCooldowns'] as Record<string, number>) ?? {};
    });

    document.addEventListener('buai:dismiss', (event) => {
      const detail = (event as CustomEvent).detail as { ruleId: string; until: number };
      cooldowns = { ...cooldowns, [detail.ruleId]: detail.until };
      void browser.storage.local.set({ hintCooldowns: cooldowns });
    });

    let debounce: ReturnType<typeof setTimeout> | undefined;

    const considerDraft = (): void => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const composer = adapter.findComposer(document);
        if (!composer) return;

        const draft = adapter.readDraft(document);
        // Twelve characters, because anything shorter is somebody still
        // starting a sentence and a nudge there is just noise.
        if (draft.trim().length < 12) {
          removeHint(document);
          return;
        }

        void browser.runtime
          .sendMessage({ type: 'hint:ask', prompt: draft, surface: adapter.surface })
          .then((reply) => {
            const advice = reply as
              | { show: boolean; explanation: string; ruleId: string; saving?: string; answer?: string }
              | undefined;
            if (!advice?.show) {
              removeHint(document);
              return;
            }
            showHint(
              composer,
              {
                explanation: advice.explanation,
                ruleId: advice.ruleId,
                ...(advice.saving ? { saving: advice.saving } : {}),
                ...(advice.answer ? { answer: advice.answer } : {}),
              },
              cooldowns,
            );
          })
          .catch(() => undefined);
        // 400 ms after the last keystroke. The recommender itself runs in
        // about two, so the wait is about not interrupting mid-thought.
      }, 400);
    };

    document.addEventListener('input', considerDraft, { passive: true });

    context.onInvalidated(() => {
      clearTimeout(debounce);
      clearTimeout(pending);
      clearTimeout(settled);
      removeHint(document);
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
      // retry_completion is a regeneration, and it costs as much as the first answer.
      return ['/api/organizations/[^/]+/chat_conversations/[^/]+/(?:retry_)?completion'];
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
