/**
 * Refreshes the committed snapshots the site falls back to.
 *
 * Run from the repository root with `pnpm exec tsx apps/site/scripts/snapshot.ts`.
 * It calls the same loaders the build uses, and writes what they return into
 * public/fallback/ with today's date, so a build with no network shows a list
 * that is at most a week old and says which week. A loader that itself fell
 * back leaves its file alone, because writing a snapshot of a snapshot would
 * move the date forward without moving the data.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { contributors, releases } from '../src/loaders/github';
import { substackPosts } from '../src/loaders/substack';

const today = new Date().toISOString().slice(0, 10);
const out = (name: string) => fileURLToPath(new URL(`../public/fallback/${name}.json`, import.meta.url));

const write = (name: string, note: string, items: unknown[]): void => {
  writeFileSync(out(name), `${JSON.stringify({ taken: today, note, items }, null, 2)}\n`, 'utf8');
  console.log(`  ${name}: ${items.length} items, taken ${today}`);
};

delete process.env['BUAI_OFFLINE'];

const gitContributors = await contributors();
if (gitContributors.snapshotFrom === null) {
  write('contributors', 'Used when the GitHub API cannot be reached at build time.', gitContributors.items);
} else {
  console.log('  contributors: GitHub could not be reached, snapshot left as it was');
}

const gitReleases = await releases();
if (gitReleases.snapshotFrom === null) {
  write(
    'releases',
    'Used when the GitHub API cannot be reached at build time. Empty until the first release.',
    gitReleases.items,
  );
} else {
  console.log('  releases: GitHub could not be reached, snapshot left as it was');
}

const feeds = await substackPosts();
if (feeds.snapshotFrom === null) {
  write(
    'substack',
    "Used when a contributor's Substack feed cannot be reached at build time, or when the build is offline.",
    feeds.posts,
  );
} else {
  console.log('  substack: a feed could not be reached, snapshot left as it was');
}
