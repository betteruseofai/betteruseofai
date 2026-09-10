import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { parseArgs, resolveSince } from '../src/args.js';
import { canonicalJson, stripGeneratedWith } from '../src/canonical.js';
import { run } from '../src/run.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const logs = join(repoRoot, 'fixtures', 'logs');
const NOW = '2026-09-15T12:00:00.000Z';

/** Every run points at the fixtures, so no test ever reads a real home directory. */
const cli = (extra: string[]) =>
  run([...extra, '--now', NOW, '--no-color', '--source', 'claude-code', '--dir', join(logs, 'claude-code')]);

const codexCli = (extra: string[]) =>
  run([...extra, '--now', NOW, '--no-color', '--source', 'codex', '--dir', join(logs, 'codex')]);

beforeAll(() => {
  process.env['BUOA_STATE_DIR'] = mkdtempSync(join(tmpdir(), 'buoa-cli-'));
});

describe('parsing arguments', () => {
  it('takes a value with a space or an equals sign', () => {
    expect(parseArgs(['summary', '--since', '7d']).flags['since']).toBe('7d');
    expect(parseArgs(['summary', '--since=7d']).flags['since']).toBe('7d');
  });

  it('refuses an option it does not know rather than ignoring it', () => {
    expect(parseArgs(['summary', '--sicne', '7d']).errors[0]).toContain('No such option');
  });

  it('refuses a value flag with nothing after it', () => {
    expect(parseArgs(['summary', '--since']).errors[0]).toContain('needs a value');
  });

  it('turns a relative window into a timestamp against the injected clock', () => {
    const now = new Date('2026-09-15T12:00:00.000Z');
    expect(resolveSince('7d', now)).toBe('2026-09-08T12:00:00.000Z');
    expect(resolveSince('24h', now)).toBe('2026-09-14T12:00:00.000Z');
    expect(resolveSince('2w', now)).toBe('2026-09-01T12:00:00.000Z');
    expect(resolveSince('2026-01-01T00:00:00.000Z', now)).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('canonical json', () => {
  it('sorts keys and rounds every number the same way', () => {
    expect(canonicalJson({ b: 1, a: 0.1 + 0.2 })).toBe('{\n  "a": 0.3,\n  "b": 1\n}\n');
  });

  it('keeps null, because null means we do not know', () => {
    expect(canonicalJson({ energyWh: null })).toBe('{\n  "energyWh": null\n}\n');
  });

  it('drops undefined, which means the field does not apply', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{\n  "a": 1\n}\n');
  });

  it('ends with exactly one newline and uses no carriage returns', () => {
    const text = canonicalJson({ a: [1, 2] });
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
  });

  it('strips only the fields the two implementations are allowed to differ on', () => {
    const stripped = stripGeneratedWith({
      header: { schemaVersion: 1, generatedWith: 'x', generatedAt: 'y', datasetVersion: '0.1.0' },
      body: 1,
    });
    expect(stripped['header']).toEqual({ schemaVersion: 1, datasetVersion: '0.1.0' });
    expect(stripped['body']).toBe(1);
  });
});

describe('summary', () => {
  it('reports the fixture turns and their totals', async () => {
    const result = await cli(['summary']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('8 turns');
    // The total is a lower bound, because a fixture turn hid its thinking count.
    expect(result.stdout).toMatch(/energy\s+≥ [\d.]+ Wh/);
  });

  it('names what it could not price rather than quietly dropping it', async () => {
    const result = await cli(['summary']);
    expect(result.stdout).toContain('1 of 8 turns used a model we do not recognise');
    expect(result.stdout).toContain('not in the figures above');
  });

  it('says the figures are a lower bound when a thinking count was hidden', async () => {
    const result = await cli(['summary']);
    expect(result.stdout).toContain('lower bound');
  });

  it('groups by whatever bucket is asked for', async () => {
    expect((await cli(['summary', '--by', 'model'])).stdout).toContain('MODEL');
    expect((await cli(['summary', '--by', 'session'])).stdout).toContain('session-alpha');
    expect((await cli(['summary', '--by', 'week'])).stdout).toContain('2026-08-31');
  });

  it('refuses a bucket that does not exist', async () => {
    const result = await cli(['summary', '--by', 'fortnight']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--by must be one of');
  });

  it('refuses a region we have no figures for, and says how to find one', async () => {
    const result = await cli(['summary', '--region', 'ZZ']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('models --all');
  });

  it('says something useful when the window is empty', async () => {
    const result = await cli(['summary', '--since', '2027-01-01T00:00:00.000Z']);
    expect(result.stdout).toContain('No sessions found');
  });

  it('produces canonical json that carries the dataset it used', async () => {
    const result = await cli(['summary', '--json']);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.header.schemaVersion).toBe(1);
    expect(parsed.header.datasetSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.totals.count).toBe(8);
    // Re-serialising through the canonical writer must give back the same bytes.
    expect(canonicalJson(parsed)).toBe(result.stdout);
  });

  it('is byte for byte the same on two runs with the same clock', async () => {
    const first = await cli(['summary', '--json']);
    const second = await cli(['summary', '--json']);
    expect(second.stdout).toBe(first.stdout);
  });
});

describe('sessions and the session report', () => {
  it('lists both fixture sessions', async () => {
    const result = await cli(['sessions']);
    expect(result.stdout).toContain('session-alpha');
    expect(result.stdout).toContain('session-beta');
  });

  it('takes a partial session id', async () => {
    const result = await cli(['session', 'session-be']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('session-beta');
  });

  it('shows cache writes, which routinely dominate a turn', async () => {
    const result = await cli(['session', 'session-beta']);
    expect(result.stdout).toContain('CACHE WRITE');
  });

  it('explains why the figures are uncertain', async () => {
    const result = await cli(['session', 'session-alpha']);
    expect(result.stdout).toContain('WHY THE FIGURES ARE UNCERTAIN');
  });

  it('says which session it could not find', async () => {
    const result = await cli(['session', 'nope']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('No session here matches');
  });

  it('asks which session when none was given', async () => {
    const result = await cli(['session']);
    expect(result.stderr).toContain('Which session');
  });
});

describe('export', () => {
  it('writes an empty cell for an unknown figure, never a zero', async () => {
    const result = await cli(['export', '--format', 'csv']);
    const rows = result.stdout.split('\n');
    const header = rows[0]?.split(',') ?? [];
    const unknown = rows.find((row) => row.includes('claude-opus-42'));
    expect(unknown).toBeDefined();
    const cells = unknown?.split(',') ?? [];
    for (const column of ['energy_wh_central', 'water_ml_central', 'carbon_g_central']) {
      expect(cells[header.indexOf(column)], column).toBe('');
    }
  });

  it('writes an empty cell for an undisclosed thinking count, not a zero', async () => {
    const result = await cli(['export', '--format', 'csv']);
    const rows = result.stdout.split('\n');
    const header = rows[0]?.split(',') ?? [];
    const index = header.indexOf('thinking_tokens');
    const values = rows.slice(1).map((row) => row.split(',')[index]);
    expect(values).toContain('');
    expect(values).toContain('210');
  });

  it('has one header row and one row per turn', async () => {
    const result = await cli(['export', '--format', 'csv']);
    expect(result.stdout.split('\n')).toHaveLength(9);
  });

  it('refuses a format it cannot write', async () => {
    const result = await cli(['export', '--format', 'xml']);
    expect(result.stderr).toContain('--format must be csv or json');
  });
});

describe('models', () => {
  it('says which measurement stands behind each model, and how good it is', async () => {
    const result = await cli(['models']);
    expect(result.stdout).toContain('Claude Opus 5');
    expect(result.stdout).toContain('proxy');
    expect(result.stdout).toContain('2 of 5');
  });

  it('lists the regions when asked', async () => {
    const result = await cli(['models', '--all']);
    expect(result.stdout).toContain('REGIONS');
    expect(result.stdout).toContain('WORLD');
  });
});

describe('the codex source', () => {
  it('reads rollouts and prices them', async () => {
    const result = await codexCli(['summary', '--json']);
    const parsed = JSON.parse(result.stdout);
    // Three turns in rollout-one, three in rollout-two after the reset is
    // dropped, and one archived.
    expect(parsed.totals.count).toBe(7);
  });

  it('is picked by name, and both sources can be asked for at once', async () => {
    const both = await run([
      'summary',
      '--json',
      '--now',
      NOW,
      '--source',
      'claude-code,codex',
      '--dir',
      join(logs, 'codex'),
    ]);
    expect(both.code).toBe(0);
  });

  it('refuses a source that does not exist', async () => {
    const result = await run(['summary', '--source', 'cursor']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('--source must be');
  });
});

describe('doctor', () => {
  it('reports every check as json', async () => {
    const result = await cli(['doctor', '--json']);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.checks.length).toBeGreaterThan(5);
    expect(parsed.checks.some((check: { name: string }) => check.name === 'Dataset')).toBe(true);
  });

  it('names the models it did not recognise, so they can be added', async () => {
    const result = await cli(['doctor']);
    expect(result.stdout).toContain('claude-opus-42');
  });
});

describe('the status line and the hooks', () => {
  const withoutStdin = async (argv: string[]) => {
    // Pretend there is a terminal on the other end, which is what happens when
    // somebody types the command instead of piping a payload into it.
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    try {
      return await run(argv);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: original, configurable: true });
    }
  };

  it('prints nothing rather than hanging when nothing is piped in', async () => {
    const result = await withoutStdin(['statusline']);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('does the same on the cheap path', async () => {
    const result = await withoutStdin(['statusline', '--cheap']);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('always answers a hook with valid json and a zero exit code', async () => {
    for (const event of ['Stop', 'UserPromptSubmit', 'PostModelSwitch', 'SomethingElse']) {
      const result = await withoutStdin(['hook', event]);
      expect(result.code).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    }
  });
});

describe('help and version', () => {
  it('shows the commands with no arguments at all', async () => {
    const result = await run([]);
    expect(result.stdout).toContain('COMMANDS');
    expect(result.stdout).toContain('summary');
  });

  it('reports the version with the dataset it ships with', async () => {
    const result = await run(['--version']);
    expect(result.stdout).toMatch(/betteruseofai .+ dataset \d+\.\d+\.\d+/);
  });

  it('says so plainly when the command does not exist', async () => {
    const result = await run(['summarize']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('No such command');
  });

  it('follows the copy rules: no dashes, no exclamation marks, no emoji', async () => {
    const texts = [
      (await run([])).stdout,
      (await run(['summary', '--help'])).stdout,
      (await run(['export', '--help'])).stdout,
      (await cli(['summary'])).stdout,
      (await cli(['doctor'])).stdout,
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/[–—]/);
      expect(text).not.toContain('!');
      expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      expect(text.toLowerCase()).not.toMatch(/\b(delve|leverage|seamless|robust|empower|unlock|harness)\b/);
      expect(text).not.toContain('Get started');
      expect(text).not.toContain('Learn more');
    }
  });
});

describe('the fixtures stay in step', () => {
  it('the log fixtures are the ones the readme describes', () => {
    const readme = readFileSync(join(logs, 'README.md'), 'utf8');
    expect(readme).toContain('session-alpha.jsonl');
    expect(readme).toContain('rollout-two.jsonl');
  });
});
