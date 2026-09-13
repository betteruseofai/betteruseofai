/**
 * The composer hint: a custom element that appears beside the box you are
 * typing in and suggests something smaller.
 *
 * Framework free, in a shadow root, with its own styles. It has to live inside
 * somebody else's page without inheriting their CSS or leaking into it, and
 * without pulling a framework into a content script.
 *
 * Three things it will never do, because a nudge that does any of them gets
 * the whole feature switched off, and then nothing is measured at all:
 *
 *   1. Block or delay a send. It has no access to the send button and never
 *      asks for any.
 *   2. Change the model. It says what it thinks and the person decides.
 *   3. Come back after being dismissed, until the cooldown has passed.
 */

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

const STYLE = `
  :host {
    all: initial;
    display: block;
    font-family: 'Schibsted Grotesk', system-ui, sans-serif;
    color-scheme: light dark;
  }
  .hint {
    display: flex;
    gap: 12px;
    align-items: start;
    padding: 10px 12px;
    margin: 8px 0;
    background: #f6f5f2;
    color: #14201a;
    border: 1px solid #cfcbc4;
    border-left: 3px solid #0f6b3a;
    border-radius: 0;
    font-size: 13px;
    line-height: 1.45;
  }
  .body { flex: 1 1 auto; }
  .rule {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5b665f;
    display: block;
    margin-bottom: 3px;
  }
  .answer {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-variant-numeric: tabular-nums slashed-zero;
    display: inline-block;
    margin-top: 6px;
    padding: 3px 8px;
    background: #e4e1dc;
    border: 1px solid #cfcbc4;
  }
  .saving {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 11px;
    color: #5b665f;
    display: block;
    margin-top: 4px;
  }
  button {
    flex: 0 0 auto;
    appearance: none;
    border: 0;
    background: none;
    cursor: pointer;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5b665f;
    padding: 2px 4px;
  }
  button:hover { color: #14201a; }
  button:focus-visible { outline: 2px solid #0f6b3a; outline-offset: 2px; }
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
      background: #1a1d1a;
      color: #e6e3dc;
      border-color: #2a2f2b;
      border-left-color: #3ddc84;
    }
    .rule { color: #9aa39d; }
    .answer { background: #0c0e0c; border-color: #2a2f2b; color: #e6e3dc; }
    .saving { color: #9aa39d; }
    button { color: #9aa39d; }
    button:hover { color: #e6e3dc; }
    button:focus-visible { outline-color: #3ddc84; }
  }
`;

export class BuaiHint extends HTMLElement {
  static observedAttributes = ['explanation', 'rule', 'saving', 'answer'];

  private root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private dismiss(): void {
    this.dispatchEvent(
      new CustomEvent('buai:dismiss', {
        bubbles: true,
        composed: true,
        detail: { ruleId: this.getAttribute('rule') ?? '', until: Date.now() + COOLDOWN_MS },
      }),
    );
    this.remove();
  }

  private render(): void {
    const explanation = this.getAttribute('explanation') ?? '';
    const rule = this.getAttribute('rule') ?? '';
    const saving = this.getAttribute('saving');
    const answer = this.getAttribute('answer');

    this.root.replaceChildren();

    const style = document.createElement('style');
    style.textContent = STYLE;

    const wrapper = document.createElement('div');
    wrapper.className = 'hint';
    // Polite rather than assertive: this is a suggestion arriving while
    // somebody types, and it must not interrupt a screen reader mid sentence.
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');

    const body = document.createElement('div');
    body.className = 'body';

    const ruleLabel = document.createElement('span');
    ruleLabel.className = 'rule';
    ruleLabel.textContent = rule;
    body.append(ruleLabel);

    // textContent, never innerHTML. The explanation is ours, but this element
    // lives inside somebody else's page and the habit is worth keeping.
    const text = document.createElement('span');
    text.textContent = explanation;
    body.append(text);

    if (answer) {
      const box = document.createElement('span');
      box.className = 'answer';
      box.textContent = answer;
      body.append(document.createElement('br'), box);
    }

    if (saving) {
      const note = document.createElement('span');
      note.className = 'saving';
      note.textContent = saving;
      body.append(note);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Not this one';
    button.setAttribute('aria-label', `Dismiss this suggestion and mute ${rule} for a day`);
    button.addEventListener('click', () => this.dismiss());

    wrapper.append(body, button);
    this.root.append(style, wrapper);
  }
}

/** Registers the element. Safe to call more than once. */
export const register = (): void => {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(HINT_TAG)) customElements.define(HINT_TAG, BuaiHint);
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

  register();
  removeHint(anchor.ownerDocument);

  const hint = anchor.ownerDocument.createElement(HINT_TAG);
  hint.setAttribute('explanation', content.explanation);
  hint.setAttribute('rule', content.ruleId);
  if (content.saving) hint.setAttribute('saving', content.saving);
  if (content.answer) hint.setAttribute('answer', content.answer);
  hint.setAttribute('data-buai-hint', 'true');

  anchor.parentElement?.insertBefore(hint, anchor);
  return hint;
};

export const removeHint = (document: Document): void => {
  for (const existing of document.querySelectorAll('[data-buai-hint]')) existing.remove();
};
