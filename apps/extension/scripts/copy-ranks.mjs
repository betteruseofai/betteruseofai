/**
 * Writes the o200k rank table into the extension's public folder.
 *
 * Two and a half megabytes of it. An extension service worker is built as a
 * single file, so a dynamic import gets inlined and the worker carries the
 * whole table every time it wakes. Packaging it as a file instead keeps the
 * worker small: it reads the table once, on the first count that needs it.
 *
 * This is a local file read at runtime. The address is the extension's own,
 * the file ships inside the extension, and nothing leaves the machine.
 */

import { createRequire } from 'node:module';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Resolved from the tokenizers package, which is what actually depends on it.
const require = createRequire(join(root, '..', '..', 'packages', 'tokenizers', 'package.json'));
const source = require.resolve('js-tiktoken/ranks/o200k_base');

const { default: ranks } = await import(pathToFileURL(source).href);

mkdirSync(join(root, 'public'), { recursive: true });
const target = join(root, 'public', 'o200k_base.json');
writeFileSync(target, JSON.stringify(ranks), 'utf8');

console.log(`  ${Math.round(statSync(target).size / 1024)} kB  public/o200k_base.json`);
