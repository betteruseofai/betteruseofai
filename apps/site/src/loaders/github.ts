/**
 * Build-time reads of the public GitHub API.
 *
 * This runs on the machine doing the build and never in anybody's browser.
 * The shipped site is files. If the call fails, times out, or the repository
 * does not exist yet, we fall back to a committed snapshot and the page says
 * which one it used rather than pretending the list is current.
 *
 * No token is required. One is read from the environment if present, purely
 * to raise the rate limit on a busy CI account.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REPO = 'betteruseofai/betteruseofai';
const TIMEOUT_MS = 8000;

export interface Release {
  tag: string;
  name: string;
  date: string;
  body: string;
  url: string;
}

export interface Contributor {
  login: string;
  commits: number;
  url: string;
}

export interface Fetched<T> {
  items: T[];
  /** Set when the committed snapshot was used, with the date it was taken. */
  snapshotFrom: string | null;
}

const fallback = async <T>(name: string): Promise<Fetched<T>> => {
  try {
    const path = fileURLToPath(new URL(`../../public/fallback/${name}.json`, import.meta.url));
    const raw = JSON.parse(await readFile(path, 'utf8')) as { taken: string; items: T[] };
    return { items: raw.items, snapshotFrom: raw.taken };
  } catch {
    return { items: [], snapshotFrom: null };
  }
};

const ask = async (path: string): Promise<unknown | null> => {
  const token = process.env.GITHUB_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/vnd.github+json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const releases = async (): Promise<Fetched<Release>> => {
  const raw = await ask('releases?per_page=30');
  if (!Array.isArray(raw)) return fallback<Release>('releases');
  return {
    items: raw.map((entry) => {
      const one = entry as Record<string, string>;
      return {
        tag: one.tag_name ?? '',
        name: one.name || (one.tag_name ?? ''),
        date: (one.published_at ?? '').slice(0, 10),
        body: one.body ?? '',
        url: one.html_url ?? '',
      };
    }),
    snapshotFrom: null,
  };
};

export const contributors = async (): Promise<Fetched<Contributor>> => {
  const raw = await ask('contributors?per_page=100');
  if (!Array.isArray(raw)) return fallback<Contributor>('contributors');
  return {
    items: raw.map((entry) => {
      const one = entry as Record<string, unknown>;
      return {
        login: String(one.login ?? ''),
        commits: Number(one.contributions ?? 0),
        url: String(one.html_url ?? ''),
      };
    }),
    snapshotFrom: null,
  };
};
