/**
 * Copies the latin woff2 files we actually use out of the Fontsource packages
 * and into fonts/, so the published package carries its own faces and nothing
 * ever reaches a font CDN at runtime.
 *
 * The budget is 130 kB for all of them. This script prints the total and fails
 * if it is exceeded, because a font that quietly doubles in size is a
 * performance regression nobody notices until launch.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'fonts');

/**
 * Fewer weights than the plan listed, because all of them came to 155 kB against
 * a 130 kB budget. Dropped: Big Shoulders 700, since a display face used only for
 * statement headlines does not need two weights, and Schibsted 500, since 400 and
 * 700 cover body and emphasis. Real italic is kept rather than letting the browser
 * slant the roman, which looks wrong on a grotesk.
 */
const WANTED = [
  ['big-shoulders', ['800-normal']],
  ['schibsted-grotesk', ['400-normal', '700-normal', '400-italic']],
  ['ibm-plex-mono', ['400-normal', '500-normal']],
];

const BUDGET_BYTES = 130 * 1024;

mkdirSync(out, { recursive: true });

let total = 0;
const copied = [];

for (const [family, variants] of WANTED) {
  const from = join(root, 'node_modules', '@fontsource', family, 'files');
  const available = readdirSync(from);
  for (const variant of variants) {
    const name = `${family}-latin-${variant}.woff2`;
    if (!available.includes(name)) {
      console.error(`missing font file: ${name}`);
      process.exit(1);
    }
    copyFileSync(join(from, name), join(out, name));
    const size = statSync(join(out, name)).size;
    total += size;
    copied.push([name, size]);
  }
}

for (const [name, size] of copied) {
  console.log(`  ${String(Math.round(size / 1024)).padStart(4)} kB  ${name}`);
}
console.log(`  ${String(Math.round(total / 1024)).padStart(4)} kB  total`);

if (total > BUDGET_BYTES) {
  console.error(`\nFont budget exceeded: ${Math.round(total / 1024)} kB against a limit of 130 kB.\n`);
  process.exit(1);
}
