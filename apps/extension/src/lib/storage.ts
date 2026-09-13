import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

import type { Estimate, UsageEvent } from '@betteruseofai/core';

/**
 * Everything the extension keeps, kept on this machine.
 *
 * Two decisions worth stating. Events are stored, not running totals, so a
 * change to the dataset re-prices the whole history rather than leaving stale
 * numbers behind. And prompt text is never stored: a turn arrives as text,
 * gets counted, and only the counts survive.
 */

export interface StoredEvent {
  id: string;
  event: UsageEvent;
  estimate: Estimate;
  /** The dataset the estimate was made against, so we know when to re-price. */
  datasetVersion: string;
  day: string;
  surface: string;
}

export interface Rollup {
  key: string;
  bucket: 'day' | 'week';
  count: number;
  energyWh: { low: number; central: number; high: number } | null;
  waterMl: { low: number; central: number; high: number } | null;
  carbonG: { low: number; central: number; high: number } | null;
  unknownModelCount: number;
  updated: string;
}

export interface Settings {
  regionCode: string | null;
  waterScope: 'on-site' | 'on-site + off-site' | 'lifecycle';
  carbonBasis: 'location-based' | 'provider-reported';
  hintsEnabled: boolean;
  hasLocalModel: boolean;
  mutedRules: string[];
  /** Days to keep events for. Zero means keep everything. */
  retentionDays: number;
  localUiEnabled: boolean;
  /** The first run asks where you are, once. This remembers that it asked. */
  regionAsked: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  regionCode: null,
  waterScope: 'on-site + off-site',
  carbonBasis: 'location-based',
  hintsEnabled: true,
  hasLocalModel: false,
  mutedRules: [],
  retentionDays: 180,
  localUiEnabled: false,
  regionAsked: false,
};

interface Schema extends DBSchema {
  events: {
    key: string;
    value: StoredEvent;
    indexes: { 'by-day': string; 'by-surface': string };
  };
  rollups: { key: string; value: Rollup };
  meta: { key: string; value: unknown };
}

const NAME = 'betteruseofai';
const VERSION = 1;

let database: Promise<IDBPDatabase<Schema>> | null = null;

export const db = (): Promise<IDBPDatabase<Schema>> => {
  database ??= openDB<Schema>(NAME, VERSION, {
    upgrade(instance) {
      const events = instance.createObjectStore('events', { keyPath: 'id' });
      events.createIndex('by-day', 'day');
      events.createIndex('by-surface', 'surface');
      instance.createObjectStore('rollups', { keyPath: 'key' });
      instance.createObjectStore('meta');
    },
  });
  return database;
};

/**
 * Stores a turn.
 *
 * The key comes from the adapter and is stable within a conversation, so the
 * same turn arriving twice, once from the network and once from the fallback
 * that watches the page, replaces rather than doubles. Getting this wrong is
 * the single easiest way to inflate somebody's total.
 */
export const putEvent = async (stored: StoredEvent): Promise<void> => {
  const instance = await db();
  await instance.put('events', stored);
};

export const getEvents = async (since?: string): Promise<StoredEvent[]> => {
  const instance = await db();
  const all = await instance.getAll('events');
  const filtered = since ? all.filter((one) => one.event.timestamp >= since) : all;
  return filtered.sort((a, b) =>
    a.event.timestamp < b.event.timestamp ? -1 : a.event.timestamp > b.event.timestamp ? 1 : 0,
  );
};

export const countEvents = async (): Promise<number> => (await db()).count('events');

/** Removes anything older than the retention setting. Zero means keep everything. */
export const prune = async (retentionDays: number, now: Date): Promise<number> => {
  if (retentionDays <= 0) return 0;
  const cutoff = new Date(now.getTime() - retentionDays * 86400_000).toISOString();
  const instance = await db();
  const stale = (await instance.getAll('events')).filter((one) => one.event.timestamp < cutoff);
  const transaction = instance.transaction('events', 'readwrite');
  await Promise.all(stale.map((one) => transaction.store.delete(one.id)));
  await transaction.done;
  return stale.length;
};

/** Wipes everything. Offered in the options page, and it means it. */
export const forgetEverything = async (): Promise<void> => {
  const instance = await db();
  await instance.clear('events');
  await instance.clear('rollups');
  await instance.clear('meta');
};

export const readMeta = async <T>(key: string): Promise<T | undefined> =>
  (await db()).get('meta', key) as Promise<T | undefined>;

export const writeMeta = async (key: string, value: unknown): Promise<void> => {
  const instance = await db();
  await instance.put('meta', value, key);
};

/**
 * Settings live in extension storage rather than the database, because the
 * options page and the content scripts both need them and neither should have
 * to open a database to read a handful of booleans.
 */
export interface SettingsStore {
  get(): Promise<Settings>;
  set(patch: Partial<Settings>): Promise<Settings>;
}

export const settingsStore = (area: {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}): SettingsStore => ({
  async get() {
    const stored = await area.get(['settings']);
    return { ...DEFAULT_SETTINGS, ...((stored['settings'] as Partial<Settings>) ?? {}) };
  },
  async set(patch) {
    const current = await this.get();
    const next = { ...current, ...patch };
    await area.set({ settings: next });
    return next;
  },
});
