/**
 * Build-time reads of contributors' Substack feeds.
 *
 * This runs on the machine doing the build and never in anybody's browser.
 * The shipped page is HTML. If a feed cannot be reached, times out, or the
 * build is told it is offline, the committed snapshot is used and the page
 * says which one, rather than pretending the list is current.
 *
 * The feed is parsed by hand. It is RSS 2.0 with a handful of fields, and a
 * parser dependency for that would be more code than the parsing.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import feeds from '../data/substacks.json';

const TIMEOUT_MS = 8000;

export interface Contributor {
  name: string;
  /** The Substack address, without a trailing slash. */
  url: string;
}

export interface SubstackPost {
  contributor: string;
  contributorUrl: string;
  title: string;
  url: string;
  /** ISO date, to the day. */
  date: string;
  /** The first sentence or so of the post, tags stripped. */
  summary: string;
}

export interface Fetched {
  posts: SubstackPost[];
  contributors: Contributor[];
  /** Set when the committed snapshot was used, with the date it was taken. */
  snapshotFrom: string | null;
}

const text = (xml: string, tag: string): string => {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  if (!match) return '';
  return (match[1] ?? '')
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
};

const plain = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The first sentence, or the first two hundred characters, whichever is shorter. */
const summarise = (html: string): string => {
  const words = plain(html);
  const sentence = /^(.*?[.!?])(\s|$)/.exec(words)?.[1] ?? words;
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}...` : sentence;
};

const isoDay = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

/** Turns one feed's XML into posts. Exported so the parser can be tested on a fixture. */
export const parseFeed = (xml: string, contributor: Contributor): SubstackPost[] => {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((item) => ({
      contributor: contributor.name,
      contributorUrl: contributor.url,
      title: text(item, 'title'),
      url: text(item, 'link'),
      date: isoDay(text(item, 'pubDate')),
      summary: summarise(text(item, 'description')),
    }))
    .filter((post) => post.title !== '' && post.url !== '');
};

const fallback = async (): Promise<Fetched> => {
  try {
    const path = fileURLToPath(new URL('../../public/fallback/substack.json', import.meta.url));
    const raw = JSON.parse(await readFile(path, 'utf8')) as { taken: string; items: SubstackPost[] };
    return { posts: raw.items, contributors: feeds.contributors, snapshotFrom: raw.taken };
  } catch {
    return { posts: [], contributors: feeds.contributors, snapshotFrom: null };
  }
};

const ask = async (url: string): Promise<string | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const substackPosts = async (): Promise<Fetched> => {
  const contributors = feeds.contributors as Contributor[];
  if (contributors.length === 0) return { posts: [], contributors, snapshotFrom: null };

  // CI and any deliberately offline build use the snapshot, so a test run
  // never depends on a third party being up.
  if (process.env['BUAI_OFFLINE'] === '1') return fallback();

  const results = await Promise.all(
    contributors.map(async (contributor) => {
      const xml = await ask(`${contributor.url.replace(/\/$/, '')}/feed`);
      return xml ? parseFeed(xml, contributor) : null;
    }),
  );

  // One unreachable feed means the snapshot for everyone. Mixing a fresh feed
  // with a stale one, with nothing on the page to tell them apart, would be
  // worse than an honest date.
  if (results.some((one) => one === null)) return fallback();

  const posts = results
    .flat()
    .filter((post): post is SubstackPost => post !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { posts, contributors, snapshotFrom: null };
};
