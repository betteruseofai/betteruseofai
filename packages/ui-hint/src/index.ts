/**
 * The composer hint: a custom element that appears beside the box you are
 * typing in and suggests something smaller.
 *
 * Framework free, in a shadow root, with its own styles. It has to live inside
 * somebody else's page without inheriting their CSS or leaking into it, and
 * without pulling a framework into a content script. The colours come from
 * the shared tokens through src/palette.ts, which scripts/palette.mjs writes,
 * so the hint cannot drift from the popup sitting a few pixels away.
 *
 * Three things it will never do, because a nudge that does any of them gets
 * the whole feature switched off, and then nothing is measured at all:
 *
 *   1. Block or delay a send. It has no access to the send button and never
 *      asks for any.
 *   2. Change the model. It says what it thinks and the person decides.
 *   3. Come back after being dismissed, until the cooldown has passed.
 */

import { FONT, PALETTE } from './palette.js';

export interface HintContent {
  /** The sentence, which always names the rule that produced it. */
  explanation: string;
  /** The rule id, so a dismissal can mute that rule alone. */
  ruleId: string;
  /** What the swap would save, already formatted. */
  saving?: string;
  /** An answer we worked out locally, for the arithmetic and conversion rules. */
  answer?: string;
}

export const HINT_TAG = 'buai-hint';

/** How long a dismissed rule stays quiet. */
export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const L = PALETTE.light;
const D = PALETTE.dark;

const STYLE = `
  :host {
    all: initial;
    display: block;
    font-family: ${FONT.body};
    color-scheme: light dark;
  }
  .hint {
    display: flex;
    gap: 12px;
    align-items: start;
    padding: 10px 12px;
    margin: 8px 0;
    background: ${L['bg-raised']};
    color: ${L.ink};
    border: 1px solid ${L.hairline};
    border-left: 3px solid ${L.accent};
    border-radius: 0;
    font-size: 13px;
    line-height: 1.45;
  }
  .body { flex: 1 1 auto; }
  .rule {
    font-family: ${FONT.mono};
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${L.muted};
    display: block;
    margin-bottom: 3px;
  }
  .answer {
    font-family: ${FONT.mono};
    font-variant-numeric: tabular-nums slashed-zero;
    display: inline-block;
    margin-top: 6px;
    padding: 3px 8px;
    background: ${L['bg-sunken']};
    border: 1px solid ${L.hairline};
  }
  .saving {
    font-family: ${FONT.mono};
    font-size: 11px;
    color: ${L.muted};
    display: block;
    margin-top: 4px;
  }
  button {
    flex: 0 0 auto;
    appearance: none;
    border: 0;
    background: none;
    cursor: pointer;
    font-family: ${FONT.mono};
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${L.muted};
    padding: 2px 4px;
  }
  button:hover { color: ${L.ink}; }
  button:focus-visible { outline: 2px solid ${L.accent}; outline-offset: 2px; }
  @media (prefers-reduced-motion: no-preference) {
    .hint { animation: in 200ms cubic-bezier(0.2, 0, 0.1, 1); }
    @keyframes in { from { opacity: 0; transform: translateY(4px); } }
  }

  /*
   * The dark overrides come last, and they have to. Written above the base
   * rules they lost to them on source order, which left the answer box light
   * with light text on it: invisible, and only visible in a screenshot.
   */
  @media (prefers-color-scheme: dark) {
    .hint {
      background: ${D['bg-raised']};
      color: ${D.ink};
      border-color: ${D.hairline};
      border-left-color: ${D.accent};
    }
    .rule { color: ${D.muted}; }
    .answer { background: ${D['bg-sunken']}; border-color: ${D.hairline}; color: ${D.ink}; }
    .saving { color: ${D.muted}; }
    button { color: ${D.muted}; }
    button:hover { color: ${D.ink}; }
    button:focus-visible { outline-color: ${D.accent}; }
  }
`;

let sheet: CSSStyleSheet | null | undefined;

/** Attaches the shared constructed sheet. Returns false where the browser has none. */
const adoptSheet = (root: ShadowRoot): boolean => {
  if (sheet === undefined) {
    try {
      const candidate = new CSSStyleSheet();
      if (typeof candidate.replaceSync !== 'function' || !('adoptedStyleSheets' in root)) {
        sheet = null;
      } else {
        candidate.replaceSync(STYLE);
        sheet = candidate;
      }
    } catch {
      sheet = null;
    }
  }
  if (!sheet) return false;
  root.adoptedStyleSheets = [sheet];
  return true;
};

/** Removes a hint and asks for its rule to be muted for the cooldown. */
const dismiss = (host: HTMLElement): void => {
  host.dispatchEvent(
    new CustomEvent('buai:dismiss', {
      bubbles: true,
      composed: true,
      detail: { ruleId: host.getAttribute('rule') ?? '', until: Date.now() + COOLDOWN_MS },
    }),
  );
  host.remove();
};

/**
 * Draws the hint into a shadow root from the host's attributes.
 *
 * Shared by the custom element and by the plain host showHint builds, because a
 * content script cannot rely on custom elements: in Chrome's isolated world
 * `customElements` is null, so a hint that needed one never appeared at all.
 */
const paint = (root: ShadowRoot, host: HTMLElement): void => {
  const explanation = host.getAttribute('explanation') ?? '';
  const rule = host.getAttribute('rule') ?? '';
  const saving = host.getAttribute('saving');
  const answer = host.getAttribute('answer');
  const doc = host.ownerDocument;

  root.replaceChildren();

  /*
   * The styles go in as a constructed stylesheet where the browser has them.
   * A <style> element inserted into a host page is subject to that page's
   * style-src, even inside a shadow root, and a strict host would silently
   * leave the hint unstyled. Adopted sheets are not governed by the page's
   * policy. The element form stays as the fallback for anything older.
   */
  const adopted = adoptSheet(root);

  const wrapper = doc.createElement('div');
  wrapper.className = 'hint';
  // Polite rather than assertive: this is a suggestion arriving while
  // somebody types, and it must not interrupt a screen reader mid sentence.
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const body = doc.createElement('div');
  body.className = 'body';

  const ruleLabel = doc.createElement('span');
  ruleLabel.className = 'rule';
  ruleLabel.textContent = rule;
  body.append(ruleLabel);

  // textContent, never innerHTML. The explanation is ours, but this element
  // lives inside somebody else's page and the habit is worth keeping.
  const text = doc.createElement('span');
  text.textContent = explanation;
  body.append(text);

  if (answer) {
    const box = doc.createElement('span');
    box.className = 'answer';
    box.textContent = answer;
    body.append(doc.createElement('br'), box);
  }

  if (saving) {
    const note = doc.createElement('span');
    note.className = 'saving';
    note.textContent = saving;
    body.append(note);
  }

  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = 'Not this one';
  button.setAttribute('aria-label', `Dismiss this suggestion and mute ${rule} for a day`);
  button.addEventListener('click', () => dismiss(host));

  wrapper.append(body, button);
  if (adopted) {
    root.append(wrapper);
  } else {
    const style = doc.createElement('style');
    style.textContent = STYLE;
    root.append(style, wrapper);
  }
};

/**
 * The same hint as a custom element, for a page that wants to write
 * `<buai-hint>` itself. The extension does not depend on it.
 */
export const defineHintElement = (): typeof HTMLElement | null => {
  if (typeof HTMLElement === 'undefined') return null;
  return class BuaiHint extends HTMLElement {
    static observedAttributes = ['explanation', 'rule', 'saving', 'answer'];

    connectedCallback(): void {
      paint(this.shadowRoot ?? this.attachShadow({ mode: 'open' }), this);
    }

    attributeChangedCallback(): void {
      if (this.isConnected) paint(this.shadowRoot ?? this.attachShadow({ mode: 'open' }), this);
    }
  };
};

/**
 * Registers the element where custom elements exist. Safe to call more than
 * once, and safe in a content script, where the registry is null.
 */
export const register = (): void => {
  const registry = (globalThis as { customElements?: CustomElementRegistry | null }).customElements;
  if (!registry || registry.get(HINT_TAG)) return;
  const element = defineHintElement();
  if (element) registry.define(HINT_TAG, element);
};

/**
 * Puts a hint next to a composer, replacing any hint already there.
 *
 * Returns the element, or null when the rule is still in its cooldown. The
 * caller owns the cooldown map, because it is the caller that can persist it.
 */
export const showHint = (
  anchor: HTMLElement,
  content: HintContent,
  cooldowns: Record<string, number> = {},
  now: number = Date.now(),
): HTMLElement | null => {
  if ((cooldowns[content.ruleId] ?? 0) > now) return null;

  removeHint(anchor.ownerDocument);

  // A plain host with its own shadow root, painted here. No registry needed,
  // so it renders the same in a content script as in a page.
  const hint = anchor.ownerDocument.createElement(HINT_TAG);
  hint.setAttribute('explanation', content.explanation);
  hint.setAttribute('rule', content.ruleId);
  if (content.saving) hint.setAttribute('saving', content.saving);
  if (content.answer) hint.setAttribute('answer', content.answer);
  hint.setAttribute('data-buai-hint', 'true');

  anchor.parentElement?.insertBefore(hint, anchor);
  // Where the element is registered it has painted itself on insertion.
  if (!hint.shadowRoot) paint(hint.attachShadow({ mode: 'open' }), hint);
  return hint;
};

export const removeHint = (document: Document): void => {
  for (const existing of document.querySelectorAll('[data-buai-hint]')) existing.remove();
};
