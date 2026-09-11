#!/usr/bin/env node
/**
 * Fills the script and style directives into the shipped headers.
 *
 * Two policies reach the browser: the meta tag Astro writes into each page,
 * carrying a hash for every inline script and style it emitted, and the real
 * header from _headers. A browser enforces both, so the strictest wins, and a
 * header that omits those hashes blocks the islands from ever hydrating.
 *
 * Rather than weaken the header and let the meta do the work alone, this reads
 * the directives back out of the built pages and writes them into the header,
 * so the two say the same thing. The union across pages is used, because one
 * header file applies to all of them.
 *
 * public/_headers is the template. It carries the directives a meta tag cannot
 * express, frame-ancestors among them, and its script and style directives are
 * placeholders that this replaces.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

/** Everything Astro may put a hash or a source on. */
const OURS = /^(script|style)-src(-elem|-attr)?$/;

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });

/** Every script or style directive in a page's meta policy, as a map. */
const directivesIn = (html) => {
  const meta = html.match(/http-equiv="content-security-policy" content="([^"]*)"/i);
  const found = new Map();
  if (!meta) return found;
  for (const part of (meta[1] ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name && OURS.test(name)) found.set(name, sources);
  }
  return found;
};

/** Directive name to the union of its sources across every page. */
const union = new Map();
let pagesWithPolicy = 0;

for (const file of htmlFiles(dist)) {
  const found = directivesIn(readFileSync(file, 'utf8'));
  if (found.size > 0) pagesWithPolicy += 1;
  for (const [name, sources] of found) {
    const already = union.get(name) ?? new Set();
    for (const source of sources) already.add(source);
    union.set(name, already);
  }
}

if (pagesWithPolicy === 0) {
  console.error('No page carried a content security policy. Is security.csp still on?');
  process.exit(1);
}

const headers = readFileSync(join(root, 'public', '_headers'), 'utf8');
const line = headers.match(/Content-Security-Policy: (.*)/);
if (!line) {
  console.error('public/_headers has no Content-Security-Policy line to fill.');
  process.exit(1);
}

// Keep the template's own directives in their original order, replace the ones
// Astro owns, and append any it emitted that the template did not name.
const kept = [];
const replaced = new Set();
for (const part of (line[1] ?? '').split(';')) {
  const trimmed = part.trim();
  if (!trimmed) continue;
  const name = trimmed.split(/\s+/)[0];
  if (name && OURS.test(name) && union.has(name)) {
    kept.push(`${name} ${[...union.get(name)].join(' ')}`);
    replaced.add(name);
  } else {
    kept.push(trimmed);
  }
}
for (const [name, sources] of union) {
  if (!replaced.has(name)) kept.push(`${name} ${[...sources].join(' ')}`);
}

if (replaced.size === 0) {
  console.error('The policy named no script or style directive for us to fill.');
  process.exit(1);
}

writeFileSync(
  join(dist, '_headers'),
  headers.replace(/(Content-Security-Policy: )(.*)/, `$1${kept.join('; ')}`),
  'utf8',
);

const counts = [...union].map(([name, sources]) => `${name}:${sources.size}`).join(' ');
console.log(`_headers written from ${pagesWithPolicy} pages. ${counts}`);
