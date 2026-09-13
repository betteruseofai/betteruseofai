#!/usr/bin/env node
// Reads the cached status line and prints it. No dataset, no transcript parse.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

let payload = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) payload += chunk;

try {
  const input = JSON.parse(payload);
  const dir =
    process.env.BUAI_STATE_DIR ??
    join(process.env.CLAUDE_PLUGIN_DATA ?? join(homedir(), '.claude'), 'betteruseofai', 'state');
  const safe = String(input.session_id).replace(/[^A-Za-z0-9_-]/g, '_');
  process.stdout.write(readFileSync(join(dir, safe + '.line'), 'utf8').trimEnd());
} catch {
  // Nothing to say is better than a wrong number, and an error message would
  // become the status line.
}
