import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COOLDOWN_MS, HINT_TAG, register, removeHint, showHint } from '../src/index.js';

/**
 * The hint lives inside somebody else's page, so most of these tests are about
 * restraint: what it does not touch, what it does not do twice, and what
 * happens when somebody says no.
 */

let composer: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="page"><div id="composer" contenteditable="true"></div></div>';
  composer = document.getElementById('composer') as HTMLElement;
  register();
});

const content = {
  explanation: 'Rule downgrade.rewrite-task fired: starts with "rewrite"; 12 words; no code.',
  ruleId: 'downgrade.rewrite-task',
};

describe('showing a hint', () => {
  it('puts one beside the composer', () => {
    const hint = showHint(composer, content);
    expect(hint).not.toBeNull();
    expect(document.querySelectorAll(HINT_TAG)).toHaveLength(1);
    expect(hint?.nextElementSibling).toBe(composer);
  });

  it('names the rule, so the advice can be argued with', () => {
    const hint = showHint(composer, content);
    expect(hint?.shadowRoot?.textContent).toContain('downgrade.rewrite-task');
  });

  it('shows an answer when we worked one out', () => {
    const hint = showHint(composer, { ...content, ruleId: 'no-llm.arithmetic', answer: '391' });
    expect(hint?.shadowRoot?.querySelector('.answer')?.textContent).toBe('391');
  });

  it('shows the saving when there is one', () => {
    const hint = showHint(composer, { ...content, saving: 'about 0.48 Wh' });
    expect(hint?.shadowRoot?.querySelector('.saving')?.textContent).toBe('about 0.48 Wh');
  });

  it('never leaves two hints on a page', () => {
    showHint(composer, content);
    showHint(composer, { ...content, ruleId: 'downgrade.summarise' });
    expect(document.querySelectorAll(HINT_TAG)).toHaveLength(1);
  });

  it('keeps its styles to itself, in a shadow root', () => {
    const hint = showHint(composer, content);
    expect(hint?.shadowRoot).not.toBeNull();
    // Nothing of ours in the page's own tree beyond the one element.
    expect(document.querySelector('#page style')).toBeNull();
  });

  it('writes text as text, never as markup', () => {
    const hint = showHint(composer, {
      ...content,
      explanation: 'Rule fired <img src=x onerror="alert(1)"> and said so.',
    });
    expect(hint?.shadowRoot?.querySelector('img')).toBeNull();
    expect(hint?.shadowRoot?.textContent).toContain('<img src=x');
  });
});

describe('saying no', () => {
  it('removes the hint and asks for that rule to be muted for a day', () => {
    const hint = showHint(composer, content);
    const dismissals: Array<{ ruleId: string; until: number }> = [];
    document.addEventListener('buoa:dismiss', (event) => {
      dismissals.push((event as CustomEvent).detail);
    });

    const now = Date.now();
    (hint?.shadowRoot?.querySelector('button') as HTMLButtonElement).click();

    expect(document.querySelectorAll(HINT_TAG)).toHaveLength(0);
    expect(dismissals).toHaveLength(1);
    expect(dismissals[0]?.ruleId).toBe('downgrade.rewrite-task');
    expect(dismissals[0]?.until).toBeGreaterThanOrEqual(now + COOLDOWN_MS - 1000);
  });

  it('stays away for the cooldown, and only for that rule', () => {
    const now = 1_000_000;
    const cooldowns = { 'downgrade.rewrite-task': now + COOLDOWN_MS };

    expect(showHint(composer, content, cooldowns, now)).toBeNull();
    // A different rule is not muted by dismissing this one.
    expect(showHint(composer, { ...content, ruleId: 'downgrade.summarise' }, cooldowns, now)).not.toBeNull();
    // And it comes back once the day is up.
    expect(showHint(composer, content, cooldowns, now + COOLDOWN_MS + 1)).not.toBeNull();
  });
});

describe('what it refuses to touch', () => {
  it('adds nothing to the composer itself', () => {
    const before = composer.outerHTML;
    showHint(composer, content);
    expect(composer.outerHTML).toBe(before);
  });

  it('has no way to press send, and does not look for one', () => {
    document.body.innerHTML += '<button id="send">Send</button>';
    const send = document.getElementById('send') as HTMLButtonElement;
    const pressed = vi.fn();
    send.addEventListener('click', pressed);

    showHint(composer, content);
    expect(pressed).not.toHaveBeenCalled();
    expect(send.disabled).toBe(false);
  });

  it('is polite to a screen reader rather than assertive', () => {
    const hint = showHint(composer, content);
    const region = hint?.shadowRoot?.querySelector('[role="status"]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('gives its dismiss button a label that says what it does', () => {
    const hint = showHint(composer, content);
    const button = hint?.shadowRoot?.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('downgrade.rewrite-task');
    expect(button?.getAttribute('aria-label')).toContain('mute');
  });

  it('can be cleared without knowing where it was put', () => {
    showHint(composer, content);
    removeHint(document);
    expect(document.querySelectorAll(HINT_TAG)).toHaveLength(0);
  });
});

describe('the copy', () => {
  it('follows the rules, like everything else that is shown to somebody', () => {
    const hint = showHint(composer, { ...content, saving: 'about 0.48 Wh' });
    const text = hint?.shadowRoot?.textContent ?? '';
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toContain('!');
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(text).not.toContain('Learn more');
    expect(text).not.toContain('Get started');
  });
});

describe('the stylesheet', () => {
  it('puts the dark overrides after the rules they override', async () => {
    // Source order decides between rules of equal specificity. With the dark
    // block written first, the answer box stayed light and its text went
    // invisible against it. Only a screenshot showed that, so this guards it.
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts'),
      'utf8',
    );
    const base = source.indexOf('.answer {');
    const dark = source.indexOf('@media (prefers-color-scheme: dark)');
    expect(base).toBeGreaterThan(-1);
    expect(dark).toBeGreaterThan(base);
  });
});
