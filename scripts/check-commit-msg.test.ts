import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script, no type declarations by design
import { checkCommitMessage, stripComments } from './check-commit-msg.mjs';

const ids = (message: string): string[] =>
  checkCommitMessage(message).map((problem: { id: string }) => problem.id);

describe('commit message attribution rule', () => {
  it('accepts an ordinary message', () => {
    expect(ids('feat(core): add the per-query-set normaliser')).toEqual([]);
  });

  it('accepts a human co-author', () => {
    expect(ids('fix: off by one\n\nCo-Authored-By: Jane Doe <jane@example.com>')).toEqual([]);
  });

  it('rejects an AI co-author trailer', () => {
    expect(ids('fix: thing\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')).toEqual([
      'coauthor-ai',
    ]);
  });

  it.each([
    'Co-Authored-By: GPT-5 <x@openai.com>',
    'Co-Authored-By: Gemini <x@google.com>',
    'Co-Authored-By: GitHub Copilot <x@github.com>',
    'co-authored-by: anthropic claude <x@y>',
  ])('rejects %s', (trailer) => {
    expect(ids(`chore: bump\n\n${trailer}`)).toContain('coauthor-ai');
  });

  it('rejects a generated-with footer and its emoji separately', () => {
    expect(ids('docs: readme\n\n\u{1F916} Generated with Claude Code').sort()).toEqual([
      'generated-with',
      'robot-emoji',
    ]);
  });

  it('rejects an assisted-by line', () => {
    expect(ids('chore: bump\n\nAI-assisted: yes')).toEqual(['assisted-by']);
  });

  it('does not fire on a model name used as subject matter', () => {
    expect(ids('feat(dataset): add the gpt-5 and claude opus 4.5 alias rows')).toEqual([]);
  });

  it('ignores git comment lines', () => {
    expect(ids('feat: x\n# Co-Authored-By: Claude <a@b>')).toEqual([]);
  });

  it('ignores everything after the scissors line', () => {
    const message =
      'feat: x\n# ------------------------ >8 ------------------------\ndiff mentioning Generated with Claude\n';
    expect(ids(message)).toEqual([]);
  });

  it('strips comments without touching the body', () => {
    expect(stripComments('one\n# comment\ntwo')).toBe('one\ntwo');
  });
});
