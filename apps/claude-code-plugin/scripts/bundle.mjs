/**
 * Bundles the command line tool into one file the plugin can run.
 *
 * The plugin ships a single JavaScript file rather than depending on an npm
 * install, so it works the moment it is added and does not go stale against a
 * globally installed version. The dataset is inlined, which is most of the
 * size, and that is the point: the numbers have to travel with the code or the
 * plugin would have to fetch them, and nothing here fetches anything.
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repo = join(root, '..', '..');
const outFile = join(root, 'dist', 'betteruseofai.mjs');

mkdirSync(join(root, 'dist'), { recursive: true });

await build({
  entryPoints: [join(repo, 'apps', 'cli-ts', 'src', 'cli.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  // The dataset is JSON on disk and read through createRequire, which esbuild
  // cannot follow. Resolving it here keeps the bundle self contained.
  loader: { '.json': 'json' },
  // No banner: the entry point already carries a shebang and esbuild keeps it,
  // so adding one here produced two and broke the file.
  logLevel: 'warning',
  minify: false,
  sourcemap: false,
});

const size = statSync(outFile).size;
console.log(`  ${Math.round(size / 1024)} kB  dist/betteruseofai.mjs`);

/*
 * The status line shim.
 *
 * This started as a shell script, on the assumption that avoiding Node would
 * be faster. Measured on this machine, against a 77 ms harness baseline, that
 * assumption was wrong by a factor of three:
 *
 *   node, this shim                48 ms
 *   node, the full bundle --cheap  47 ms
 *   sh with sed and tr            133 ms
 *   powershell 5.1                274 ms
 *
 * Git Bash and PowerShell both start slower than Node, and the plugin needs
 * Node for its hooks regardless, so the shell shims were deleted rather than
 * kept as a fallback nobody would want. Around 48 ms clears the tens of
 * milliseconds the status line is meant to answer in.
 *
 * Claude Code does not expand plugin variables inside settings.json, so the
 * setup command writes an absolute path to this file.
 */
writeFileSync(
  join(root, 'dist', 'statusline.mjs'),
  `#!/usr/bin/env node
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
`,
  'utf8',
);
console.log('  wrote dist/statusline.mjs');
