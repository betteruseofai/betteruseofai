import { describe, expect, it } from 'vitest';

import { ADAPTERS, claudeAdapter } from '../src/adapters/index.js';
import { currentHealth, healthNotes, looksSignedOut, recordHealth } from '../src/lib/health.js';

const page = (password: boolean) =>
  ({
    querySelector: (selector: string) => (password && selector === 'input[type="password"]' ? {} : null),
  }) as unknown as Document;

describe('site health', () => {
  it('keeps what an adapter reported, and forgets it once the adapter moves on', () => {
    const stored = recordHealth({}, 'claude-web', claudeAdapter.version, 'unsupported', '2026-10-30T10:00:00Z');
    expect(currentHealth(stored, ADAPTERS)['claude-web']?.state).toBe('unsupported');

    const old = recordHealth({}, 'claude-web', claudeAdapter.version - 1, 'unsupported', '2026-10-30T10:00:00Z');
    expect(currentHealth(old, ADAPTERS)).toEqual({});
  });

  it('tells a sign-in page from a site that changed', () => {
    expect(looksSignedOut('/login', page(false))).toBe(true);
    expect(looksSignedOut('/auth/login', page(false))).toBe(true);
    expect(looksSignedOut('/', page(true))).toBe(true);
    expect(looksSignedOut('/chat/abc', page(false))).toBe(false);
    // A word that only starts like one is not one.
    expect(looksSignedOut('/authors', page(false))).toBe(false);
  });

  it('says nothing about a signed out page, and only what is true about a broken one', () => {
    expect(healthNotes({ 'claude-web': { state: 'signed-out', version: 1, at: '' } })).toEqual([]);
    const broken = healthNotes({ 'chatgpt-web': { state: 'unsupported', version: 1, at: '' } });
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain('chatgpt.com');
    // It never stopped counting, so it must not say it did.
    expect(broken[0]).not.toContain('stopped counting');
  });
});
