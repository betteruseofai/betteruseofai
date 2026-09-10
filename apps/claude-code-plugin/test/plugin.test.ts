import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The plugin, exercised the way Claude Code exercises it: a JSON payload on
 * standard input, and whatever comes back on standard output.
 *
 * These run against the bundle rather than the source, because the bundle is
 * what ships and the bundle is what broke twice while it was being written.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..', '..');
const bundle = join(root, 'dist', 'betteruseofai.mjs');
const shim = join(root, 'dist', 'statusline.mjs');
const transcript = join(
  repo,
  'fixtures',
  'logs',
  'claude-code',
  'projects',
  'example-project',
  'session-alpha.jsonl',
);

let stateDir: string;

const call = (script: string, argv: string[], payload: unknown): string =>
  execFileSync(process.execPath, [script, ...argv], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, BUOA_STATE_DIR: stateDir },
  });

beforeAll(() => {
  stateDir = mkdtempSync(join(tmpdir(), 'buoa-plugin-'));
  if (!existsSync(bundle)) {
    execFileSync(process.execPath, [join(root, 'scripts', 'bundle.mjs')], { cwd: root });
  }
});

describe('the manifests', () => {
  it('the plugin manifest is valid and names no AI tooling as its author', () => {
    const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    expect(manifest.name).toBe('betteruseofai');
    expect(JSON.stringify(manifest).toLowerCase()).not.toMatch(
      /generated|co-authored|assistant wrote/,
    );
  });

  it('every hook points at a file that exists', () => {
    const hooks = JSON.parse(readFileSync(join(root, 'hooks', 'hooks.json'), 'utf8'));
    const events = Object.keys(hooks.hooks);
    expect(events).toContain('UserPromptSubmit');
    expect(events).toContain('Stop');
    for (const group of Object.values(hooks.hooks) as Array<{ hooks: Array<{ command: string }> }[]>) {
      for (const entry of group) {
        for (const one of entry.hooks) {
          expect(one.command).toContain('dist/betteruseofai.mjs');
        }
      }
    }
    expect(existsSync(bundle)).toBe(true);
  });

  it('every command file has front matter and a description', () => {
    for (const name of readdirSync(join(root, 'commands'))) {
      const text = readFileSync(join(root, 'commands', name), 'utf8');
      expect(text.startsWith('---\n'), name).toBe(true);
      expect(text, name).toMatch(/^description: .+$/m);
    }
  });

  it('the commands and the skill follow the copy rules', () => {
    const files = [
      ...readdirSync(join(root, 'commands')).map((n) => join(root, 'commands', n)),
      join(root, 'skills', 'betteruseofai-methodology', 'SKILL.md'),
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/[–—]/);
      expect(text, file).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      expect(text.toLowerCase(), file).not.toMatch(
        /\b(delve|leverage|seamless|robust|empower|unlock|elevate)\b/,
      );
      expect(text, file).not.toContain('Get started');
    }
  });
});

describe('the bundle', () => {
  it('runs on its own, with the dataset inside it', () => {
    const version = execFileSync(process.execPath, [bundle, '--version'], { encoding: 'utf8' });
    expect(version).toMatch(/dataset \d+\.\d+\.\d+/);
  });

  it('carries the dataset rather than reaching for it, so it works anywhere', () => {
    const text = readFileSync(bundle, 'utf8');
    expect(text).toContain('jegham.claude-3.7-sonnet');
    // Nothing in the shipped file should be opening a socket.
    expect(text).not.toMatch(/require\(['"]node:https?['"]\)/);
    expect(text).not.toMatch(/from ['"]node:https?['"]/);
  });

  it('has exactly one shebang, on the first line', () => {
    const lines = readFileSync(bundle, 'utf8').split('\n');
    expect(lines[0]).toBe('#!/usr/bin/env node');
    expect(lines.slice(1).filter((line) => line.startsWith('#!'))).toEqual([]);
  });
});

describe('the hooks', () => {
  const payload = (extra: Record<string, unknown> = {}) => ({
    session_id: 'plugin-test',
    transcript_path: transcript,
    model: { id: 'claude-opus-5' },
    ...extra,
  });

  it('always answer with valid json and never fail', () => {
    for (const event of ['Stop', 'UserPromptSubmit', 'PostModelSwitch', 'SessionStart']) {
      const out = call(bundle, ['hook', event], payload({ prompt: 'hello' }));
      expect(() => JSON.parse(out)).not.toThrow();
    }
  });

  it('the Stop hook renders the line and caches it for the shim', () => {
    call(bundle, ['hook', 'Stop'], payload());
    const cached = readFileSync(join(stateDir, 'plugin-test.line'), 'utf8');
    expect(cached).toMatch(/Wh/);
    expect(cached).toMatch(/mL/);
  });

  it('the prompt hook nudges on a rewrite and stays quiet on engineering', () => {
    const nudge = JSON.parse(
      call(bundle, ['hook', 'UserPromptSubmit'], payload({ prompt: 'Rewrite this more plainly.' })),
    );
    expect(nudge.systemMessage).toContain('downgrade.rewrite-task');

    const quiet = JSON.parse(
      call(
        bundle,
        ['hook', 'UserPromptSubmit'],
        payload({ prompt: 'Explain why this deadlock happens and derive the fix.' }),
      ),
    );
    expect(quiet.systemMessage).toBeUndefined();
  });

  it('say nothing at all when the payload is not one of ours', () => {
    expect(JSON.parse(call(bundle, ['hook', 'Stop'], { nonsense: true }))).toEqual({});
  });
});

describe('the status line shim', () => {
  it('prints the cached line', () => {
    call(bundle, ['hook', 'Stop'], { session_id: 'shim-test', transcript_path: transcript });
    const line = call(shim, [], { session_id: 'shim-test' });
    expect(line).toMatch(/Wh/);
  });

  it('prints nothing rather than an error when there is no cache', () => {
    expect(call(shim, [], { session_id: 'never-seen-before' })).toBe('');
  });

  it('prints nothing rather than an error on rubbish input', () => {
    expect(call(shim, [], 'not an object')).toBe('');
  });

  it('answers fast enough for a status line', () => {
    call(bundle, ['hook', 'Stop'], { session_id: 'speed-test', transcript_path: transcript });
    const started = performance.now();
    for (let run = 0; run < 5; run += 1) call(shim, [], { session_id: 'speed-test' });
    const each = (performance.now() - started) / 5;
    // Generous, because a loaded continuous integration machine is not a laptop.
    // The point is that it never grows into the seconds.
    expect(each).toBeLessThan(1500);
  });
});
