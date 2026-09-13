#!/usr/bin/env node
/**
 * The copy rules, run against what a reader actually sees.
 *
 * Vale has no parser for .astro, so pointing it at the source means it reads
 * the JavaScript as prose: every `!==` becomes an exclamation mark and every
 * `prefers-color-scheme` becomes an American spelling. So this pulls the text
 * out of the built pages, writes it where Vale can read it, and lints that.
 *
 * It also runs four structural checks that Vale cannot express:
 *
 *   - no page is missing its status
 *   - no published page contains a TODO
 *   - a word never runs into an inline tag, which Astro does silently when the
 *     tag sits at a line boundary
 *   - a page with figures on it has sources on it
 *   - a multiplier written in prose sits on a page with sources on it
 *   - sentences average under twenty words, and none runs past thirty-six
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = dirname(dirname(root));
const dist = join(root, 'dist');

const pages = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name.endsWith('.html') ? [path] : [];
  });

/** Strips tags, keeping the words and the paragraph breaks between them. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Source panels quote other people's titles verbatim. Those are citations,
    // not our copy, and we are not entitled to rewrite them to suit a style
    // guide. "Assessing Energy, Water, and Carbon Footprint of LLM Inference"
    // is a paper, not a list of three that we chose to write.
    .replace(/<span class="buai-source__body">[\s\S]*?<\/span><\/details>/gi, ' ')
    // A summary is a heading by role. Emitting it as one keeps the FAQ out of
    // the rules aimed at body copy, where a question mark is the whole point.
    .replace(/<summary[^>]*>([\s\S]*?)<\/summary>/gi, '\n\n## $1\n\n')
    .replace(/<\/(p|li|h[1-6]|td|th|div|section|details)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&ge;/g, '>=')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const files = pages(dist);
if (files.length === 0) {
  console.error('No built pages. Run the build first.');
  process.exit(1);
}

const problems = [];

/** Cleared when Vale is not installed, which the final line reports. */
let ranVale = true;

// ------------------------------------------------------- structural checks

/**
 * Astro drops the whitespace between a word and an inline tag when the tag
 * begins or ends a source line, which reads as "the<a>calculator</a>". Write
 * an explicit {' '} at that break.
 */
const RAN_TOGETHER = /(\w)(<a |<code>|<strong>|<em>)|(<\/a>|<\/code>|<\/strong>|<\/em>)(\w)/g;

/** Tags that legitimately sit flush against each other, not against a word. */
const ALLOWED_FLUSH = [
  /<\/a><a /,
  /<\/a><button/,
  /<\/a><span class="buai-source__meta"/,
  /<\/a><div/,
  /<\/a><\/li>/,
];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const name = relative(dist, file);
  const body = html.slice(html.indexOf('<main'));

  for (const match of body.match(RAN_TOGETHER) ?? []) {
    if (ALLOWED_FLUSH.some((one) => one.test(match))) continue;
    problems.push(`${name}: a word runs into a tag, "${match}". Put a {' '} at the line break.`);
  }

  if (!/name="robots"/.test(html)) {
    problems.push(`${name}: no robots meta, which means the page has no status.`);
  }

  const published = /name="robots" content="index/.test(html);
  if (published && /\bTODO\b/.test(textOf(body))) {
    problems.push(`${name}: published, and still contains a TODO.`);
  }

  // A page that states figures has to show where they came from. The
  // calculator carries its sources in its own panel rather than in chips, so
  // that counts too.
  const statesFigures = /buai-readout__figure|buai-num/.test(body);
  const showsSources = /buai-source|calc__why/.test(body);
  if (statesFigures && !showsSources) {
    problems.push(`${name}: prints figures with no source anywhere on the page.`);
  }

  // A comparison written in words is a number too. "A few hundred times" on a
  // page with no chip was the one unsourced claim the audit found, and the
  // check above could not see it because it was not in a readout.
  const multiplier = /(?:[a-z]+|\d+) times|factor of (?:about )?(?:[a-z]+|\d+)/i;
  // The calculator shows its sources for whatever it is asked, so a link into
  // it with the comparison preset counts as a source for the comparison.
  const pointsAtCalculator = /href="\/calculator#/.test(body);
  if (multiplier.test(textOf(body)) && !showsSources && !pointsAtCalculator) {
    problems.push(`${name}: says something is so many times something else, with no source on the page.`);
  }
}

// ------------------------------------------------------------ sentences

/**
 * The one rule in STYLE.md that is a number rather than a judgement: sentences
 * average under twenty words.
 *
 * Measured over body copy only. Headings, tables, navigation and the source
 * panels are all excluded, because running them together produces sentences
 * nobody wrote and a figure nobody can act on.
 */
const MEAN_LIMIT = 20;
const LONGEST_LIMIT = 36;

const bodyCopy = (html) => {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(table|nav|footer|details)[\s\S]*?<\/\1>/gi, ' ')
    // A dropdown's options are choices, not prose. Left in, the landing page's
    // one sentence reads as a thirty-nine word run of every model name.
    .replace(/<select[\s\S]*?<\/select>/gi, ' ');
  return [...body.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(([, , inner]) =>
      inner.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    .filter((text) => text.split(' ').length > 3);
};

for (const file of files) {
  const name = relative(dist, file);
  const sentences = bodyCopy(readFileSync(file, 'utf8'))
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[A-Z"'(])/))
    .map((one) => one.trim())
    .filter((one) => one.split(/\s+/).length > 2);

  // A page with almost no prose on it says nothing about the average.
  if (sentences.length < 8) continue;

  const lengths = sentences.map((one) => one.split(/\s+/).length);
  const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  if (mean > MEAN_LIMIT) {
    problems.push(`${name}: sentences average ${mean.toFixed(1)} words, over ${MEAN_LIMIT}.`);
  }
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length;
    if (words > LONGEST_LIMIT) {
      problems.push(`${name}: a ${words} word sentence. "${sentence.slice(0, 70)}..."`);
    }
  }
}

// -------------------------------------------------------------------- vale

const scratch = mkdtempSync(join(tmpdir(), 'buai-copy-'));
try {
  for (const file of files) {
    const name = relative(dist, file).replace(/[\\/]/g, '-').replace(/\.html$/, '.md');
    const text = textOf(readFileSync(file, 'utf8'));
    mkdirSync(dirname(join(scratch, name)), { recursive: true });
    writeFileSync(join(scratch, name), text, 'utf8');
  }

  let output = '';
  try {
    // JSON, not line. The line format carries no severity, so a filter over it
    // matches nothing and the lint passes whatever it found. That happened.
    output = execFileSync(
      process.platform === 'win32' ? 'vale.exe' : 'vale',
      ['--config', join(repo, '.vale.ini'), '--output=JSON', scratch],
      { encoding: 'utf8', cwd: repo },
    );
  } catch (error) {
    output = `${error.stdout ?? ''}`;
    // ENOENT means Vale is not installed on this machine, which is the normal
    // case on the test matrix. The dedicated copy workflow installs it and
    // sets REQUIRE_VALE, so the rules are still gated exactly once.
    if (error.code === 'ENOENT') ranVale = false;
  }

  let found = {};
  if (!ranVale) {
    if (process.env.REQUIRE_VALE === '1') {
      console.error('Vale is required here and is not on the path.');
      process.exit(1);
    }
    console.log('  skipped  Vale is not installed, so only the structural checks ran.');
  } else {
    try {
      found = JSON.parse(output || '{}');
    } catch {
      console.error('Vale ran but did not return JSON.');
      console.error(output.slice(0, 400));
      process.exit(1);
    }
  }

  for (const [file, alerts] of Object.entries(found)) {
    const name = file.replace(scratch, '').replace(/^[\/]/, '');
    for (const alert of alerts) {
      const line = `${name}:${alert.Line} ${alert.Check}: ${alert.Message}`;
      if (alert.Severity === 'error') problems.push(line);
      else console.log(`  ${alert.Severity}  ${line}`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ------------------------------------------------------------------ report

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in the copy:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `${files.length} pages, ${ranVale ? 'copy rules clean' : 'structural checks clean, copy rules not run'}.`,
);
