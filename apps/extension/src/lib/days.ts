import type { Aggregate } from '@betteruseofai/core';

/**
 * Days as the person lives them.
 *
 * Every timestamp is stored in UTC, as everywhere else in the project. The
 * popup and dashboard draw a day's line at the viewer's own midnight, because
 * "today" starting at 5:30 in the morning in India, or at seven in the evening
 * on the US east coast, is a bug nobody would read as a convention (audit X11,
 * decided 2026-11-19). The command line tools keep UTC days, so their output
 * stays the same on every machine.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** The calendar day this instant falls on in the browser's own time zone, as YYYY-MM-DD. */
export const localDay = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** The day after a YYYY-MM-DD date, worked out on the calendar rather than in hours. */
const nextDay = (day: string): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/** A day with nothing recorded, drawn as a gap. Not a zero: nothing was counted. */
export interface EmptyDay {
  key: string;
  empty: true;
}

/**
 * Every day from the first recorded one to the last, in order, with the days
 * between that had no turns put back as gaps. Dropping them made a quiet week
 * look like three busy days in a row.
 */
export const everyDay = (byDay: Aggregate[]): Array<Aggregate | EmptyDay> => {
  const sorted = [...byDay].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const known = new Map(sorted.map((one) => [one.key, one]));
  const days: Array<Aggregate | EmptyDay> = [];
  let day = first.key;
  while (day <= last.key) {
    // A year of bars is the most a chart of days is any use for. Past that,
    // show the days there are rather than thousands of gaps.
    if (days.length >= 366) return sorted;
    days.push(known.get(day) ?? { key: day, empty: true });
    day = nextDay(day);
  }
  return days;
};

export const isEmptyDay = (day: Aggregate | EmptyDay): day is EmptyDay => 'empty' in day;
