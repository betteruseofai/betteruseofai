import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readClaudeCode, readClaudeCodeIncremental } from '../src/claude-code.js';
import { readCodex } from '../src/codex.js';
import { readAll } from '../src/index.js';
import { emptyIncrementalState } from '../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'logs');
const claudeDir = join(fixtures, 'claude-code', 'projects');
const codexDir = join(fixtures, 'codex');

describe('the Claude Code reader', () => {
  it('reads both sessions and ignores everything that is not an assistant turn', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.files).toHaveLength(2);
    expect(result.events.map((event) => event.modelRaw)).toEqual([
      'claude-opus-5',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-sonnet-5',
      'claude-haiku-4-5-20251001',
      'claude-opus-42',
      'claude-opus-5',
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('counts a message once however many content blocks it was written across', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    const repeated = result.events.filter((event) => event.id.startsWith('msg_002:'));
    expect(repeated).toHaveLength(1);
    expect(result.skipped.duplicate).toBe(2);
    // Without the dedupe this one message would have contributed three times.
    expect(repeated[0]?.tokens.cachedRead).toBe(64049);
  });

  it('skips a synthetic line rather than reporting it as an unknown model', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.skipped.synthetic).toBe(1);
    expect(result.events.some((event) => event.modelRaw === '<synthetic>')).toBe(false);
  });

  it('skips a failed turn', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.skipped.apiError).toBe(1);
  });

  it('keeps a model it does not recognise, so it can be reported as unknown', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.events.some((event) => event.modelRaw === 'claude-opus-42')).toBe(true);
  });

  it('passes an undisclosed thinking count through as null, not as zero', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    const nullDetails = result.events.find((event) => event.id.startsWith('msg_005:'));
    const nullCount = result.events.find((event) => event.id.startsWith('msg_006:'));
    expect(nullDetails?.tokens.thinking).toBeNull();
    expect(nullCount?.tokens.thinking).toBeNull();
  });

  it('keeps a disclosed thinking count as the number it is', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.events.find((event) => event.id.startsWith('msg_001:'))?.tokens.thinking).toBe(210);
  });

  it('treats the not_available sentinel as no region and a real code as one', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.events.find((event) => event.id.startsWith('msg_001:'))?.regionHint).toBeUndefined();
    expect(result.events.find((event) => event.id.startsWith('msg_007:'))?.regionHint).toBe('US');
  });

  it('keeps cached reads apart from fresh input', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    const cacheHeavy = result.events.find((event) => event.id.startsWith('msg_101:'));
    expect(cacheHeavy?.tokens.input).toBe(1500);
    expect(cacheHeavy?.tokens.cachedRead).toBe(84000);
    expect(cacheHeavy?.tokens.cachedWrite).toBe(3000);
  });

  it('reads the rest of a file after a line it could not parse, and says so', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('Could not parse');
    // msg_009 comes after the broken line and is still reached.
    expect(result.skipped.noUsage).toBeGreaterThanOrEqual(1);
  });

  it('counts a subagent turn, which burns the same energy as any other', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    const sidechain = result.events.find((event) => event.meta?.['sidechain'] === true);
    expect(sidechain).toBeDefined();
  });

  it('filters by session and by time window', async () => {
    const bySession = await readClaudeCode({ dir: claudeDir, sessionId: 'session-beta' });
    expect(bySession.events).toHaveLength(2);
    const byTime = await readClaudeCode({ dir: claudeDir, since: '2026-09-02T00:00:00.000Z' });
    expect(byTime.events).toHaveLength(2);
    const narrow = await readClaudeCode({
      dir: claudeDir,
      since: '2026-09-01T09:00:00.000Z',
      until: '2026-09-01T09:02:00.000Z',
    });
    expect(narrow.events).toHaveLength(2);
  });

  it('says so plainly when there is nothing there', async () => {
    const result = await readClaudeCode({ dir: join(fixtures, 'does-not-exist') });
    expect(result.events).toEqual([]);
    expect(result.warnings[0]?.message).toContain('Nothing to report');
  });

  it('returns events in time order, so the two implementations agree', async () => {
    const result = await readClaudeCode({ dir: claudeDir });
    const stamps = result.events.map((event) => event.timestamp);
    expect(stamps).toEqual([...stamps].sort());
  });
});

describe('reading a transcript as it is being written', () => {
  const seed = readFileSync(join(claudeDir, 'example-project', 'session-alpha.jsonl'), 'utf8');
  const lines = seed.split('\n').filter(Boolean);

  it('reads only what has been appended since last time', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'buai-'));
    const path = join(dir, 'live.jsonl');
    writeFileSync(path, `${lines.slice(0, 2).join('\n')}\n`);

    const first = await readClaudeCodeIncremental(path, emptyIncrementalState());
    expect(first.added).toHaveLength(1);
    expect(first.state.offset).toBeGreaterThan(0);

    // Nothing new, so nothing comes back and the offset does not move.
    const idle = await readClaudeCodeIncremental(path, first.state);
    expect(idle.added).toHaveLength(0);
    expect(idle.state.offset).toBe(first.state.offset);

    appendFileSync(path, `${lines.slice(2, 5).join('\n')}\n`);
    const second = await readClaudeCodeIncremental(path, idle.state);
    // Three content blocks of one message: all three arrive, two supersede.
    expect(second.added).toHaveLength(3);
    expect(second.superseded).toHaveLength(2);
  });

  it('leaves a half-written line for next time rather than dropping it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'buai-'));
    const path = join(dir, 'partial.jsonl');
    const complete = `${lines[1]}\n`;
    writeFileSync(path, complete + lines[2]?.slice(0, 40));

    const first = await readClaudeCodeIncremental(path, emptyIncrementalState());
    expect(first.added).toHaveLength(1);
    expect(first.state.offset).toBe(Buffer.byteLength(complete, 'utf8'));

    // The writer finishes the line, and the next read picks it up whole.
    writeFileSync(path, `${complete}${lines[2]}\n`);
    const second = await readClaudeCodeIncremental(path, first.state);
    expect(second.added).toHaveLength(1);
  });

  it('starts again when the file has been replaced by a shorter one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'buai-'));
    const path = join(dir, 'rotated.jsonl');
    writeFileSync(path, `${lines.slice(0, 5).join('\n')}\n`);
    const first = await readClaudeCodeIncremental(path, emptyIncrementalState());
    expect(first.added.length).toBeGreaterThan(0);

    writeFileSync(path, `${lines[1]}\n`);
    const second = await readClaudeCodeIncremental(path, first.state);
    expect(second.added).toHaveLength(1);
    expect(Object.keys(second.state.seen)).toHaveLength(1);
  });
});

describe('the Codex reader', () => {
  it('reads live and archived rollouts', async () => {
    const result = await readCodex({ dir: codexDir });
    expect(result.files).toHaveLength(3);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it('prefers the per-turn figure where the rollout gives one', async () => {
    const result = await readCodex({ dir: codexDir });
    const first = result.events.find((event) => event.sessionId === 'one');
    expect(first?.meta?.['basis']).toBe('per-turn');
    // input_tokens 1200 with 200 of them cached leaves 1000 charged as fresh.
    expect(first?.tokens.input).toBe(1000);
    expect(first?.tokens.cachedRead).toBe(200);
  });

  it('takes the cached share out of input rather than adding it on top', async () => {
    const result = await readCodex({ dir: codexDir });
    const second = result.events.filter((event) => event.sessionId === 'one')[1];
    expect(second?.tokens.input).toBe(500);
    expect(second?.tokens.cachedRead).toBe(1500);
  });

  it('takes reasoning out of output rather than adding it on top', async () => {
    const result = await readCodex({ dir: codexDir });
    const first = result.events.find((event) => event.sessionId === 'one');
    expect(first?.tokens.output).toBe(500);
    expect(first?.tokens.thinking).toBe(300);
  });

  it('follows a model change part way through a session', async () => {
    const result = await readCodex({ dir: codexDir });
    const models = result.events.filter((event) => event.sessionId === 'one').map((event) => event.modelRaw);
    expect(models).toEqual(['gpt-5.6', 'gpt-5.6', 'gpt-4.1']);
  });

  it('differences the running total when there is no per-turn figure', async () => {
    const result = await readCodex({ dir: codexDir });
    const turns = result.events.filter((event) => event.sessionId === 'two');
    expect(turns.every((event) => event.meta?.['basis'] === 'differenced')).toBe(true);
    // First: 1000 in with none cached. Second: 2500 minus 1000 is 1500, of which
    // 800 was cached, leaving 700 charged as fresh input.
    expect(turns[0]?.tokens.input).toBe(1000);
    expect(turns[1]?.tokens.input).toBe(700);
    expect(turns[1]?.tokens.cachedRead).toBe(800);
  });

  it('yields nothing rather than a negative when a replay resets the running total', async () => {
    const result = await readCodex({ dir: codexDir });
    const turns = result.events.filter((event) => event.sessionId === 'two');
    // Four token_count entries, but the one that goes backwards contributes
    // nothing, so only three turns survive.
    expect(turns).toHaveLength(3);
    for (const turn of turns) {
      expect(turn.tokens.input ?? 0).toBeGreaterThanOrEqual(0);
      expect(turn.tokens.output ?? 0).toBeGreaterThanOrEqual(0);
      expect(turn.tokens.thinking ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it('never sums cumulative totals across turns', async () => {
    const result = await readCodex({ dir: codexDir });
    const turns = result.events.filter((event) => event.sessionId === 'two');
    const chargedInput = turns.reduce(
      (total, turn) => total + (turn.tokens.input ?? 0) + (turn.tokens.cachedRead ?? 0),
      0,
    );
    /*
     * Summing the cumulative figures as if they were per turn would give 8500.
     * Differencing gives 5500: 1000 and 1500 before the reset, then 3000 after
     * it. The session's final running total of 4000 is not the answer either,
     * because the replay started again from the parent's snapshot and the work
     * on both sides of the reset was really done. 5500 is the honest figure.
     */
    expect(chargedInput).toBe(5500);
    expect(chargedInput).toBeLessThan(8500);
  });

  it('says so plainly, with the cutoff date, when there is nothing there', async () => {
    const result = await readCodex({ dir: join(fixtures, 'does-not-exist') });
    expect(result.events).toEqual([]);
    expect(result.warnings[0]?.message).toContain('6 September 2025');
  });
});

describe('reading everything at once', () => {
  it('merges the two sources into one timeline', async () => {
    const result = await readAll({ dir: undefined, only: [] });
    expect(result.events).toEqual([]);

    const claude = await readClaudeCode({ dir: claudeDir });
    const codex = await readCodex({ dir: codexDir });
    const merged = [...claude.events, ...codex.events].sort((a, b) =>
      a.timestamp < b.timestamp ? -1 : 1,
    );
    const stamps = merged.map((event) => event.timestamp);
    expect(stamps).toEqual([...stamps].sort());
    expect(new Set(merged.map((event) => event.surface))).toEqual(
      new Set(['claude-code', 'codex-cli']),
    );
  });
});
