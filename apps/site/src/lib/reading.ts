/**
 * The reading list: what the numbers rest on, and what else is worth reading.
 *
 * Two sources, merged. The dataset's benchmark rows each cite a source with a
 * title, publisher, date and URL; those are the papers and posts the figures
 * on this site actually rest on, and they come straight from the data so the
 * list cannot drift from the method page. Then src/data/reading.json, kept by
 * hand, for writing and research that is not yet a row.
 */

import dataset from './dataset';
import hand from '../data/reading.json';

export type Kind = 'paper' | 'post' | 'report';

export interface Reading {
  title: string;
  authors: string | null;
  publisher: string;
  /** ISO, to the month or the day. */
  date: string;
  url: string;
  kind: Kind;
  about: string | null;
  /** Ids of the dataset rows that rest on this source, if any. */
  rows: string[];
}

/** A DOI or an arXiv address is a paper; the rest is a post or a report. */
const classify = (url: string, publisher: string): Kind => {
  if (/arxiv\.org|doi\.org|\/doi\//i.test(url)) return 'paper';
  if (/research|report|assessment|study/i.test(publisher)) return 'report';
  return 'post';
};

export const readingList = (): Reading[] => {
  const byUrl = new Map<string, Reading>();

  for (const row of dataset.benchmarks) {
    const { source } = row;
    const existing = byUrl.get(source.url);
    if (existing) {
      existing.rows.push(row.id);
      continue;
    }
    byUrl.set(source.url, {
      title: source.title,
      authors: null,
      publisher: source.publisher,
      date: source.date,
      url: source.url,
      kind: source.doi ? 'paper' : classify(source.url, source.publisher),
      about: null,
      rows: [row.id],
    });
  }

  for (const entry of hand.entries) {
    if (byUrl.has(entry.url)) continue;
    byUrl.set(entry.url, {
      title: entry.title,
      authors: entry.authors ?? null,
      publisher: entry.publisher,
      date: entry.date,
      url: entry.url,
      kind: entry.kind as Kind,
      about: entry.about ?? null,
      rows: [],
    });
  }

  return [...byUrl.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
};
