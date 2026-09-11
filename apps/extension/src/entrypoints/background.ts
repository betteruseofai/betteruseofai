import datasetBundle from '@betteruseofai/dataset';
import { aggregate } from '@betteruseofai/core';
import type { Dataset } from '@betteruseofai/core';

import { adapterById } from '../adapters/index.js';
import type { ExtensionMessage } from '../adapters/types.js';
import { priceTurn, reprice } from '../lib/pipeline.js';
import {
  countEvents,
  DEFAULT_SETTINGS,
  getEvents,
  prune,
  putEvent,
  readMeta,
  settingsStore,
  writeMeta,
} from '../lib/storage.js';
import type { Settings } from '../lib/storage.js';
import { browser } from 'wxt/browser';

/**
 * The background worker.
 *
 * Everything that needs the dataset happens here rather than in a content
 * script, so the two megabytes of benchmark rows are loaded once per browser
 * rather than once per tab.
 *
 * It never opens a connection. If you are reviewing this extension, that claim
 * is checkable: there is no fetch, no XMLHttpRequest and no WebSocket in this
 * file or anything it imports, and the manifest declares no remote host beyond
 * the three sites the content scripts read.
 */

const dataset = datasetBundle as unknown as Dataset;

const settings = settingsStore({
  get: (keys) => browser.storage.local.get(keys) as Promise<Record<string, unknown>>,
  set: (items) => browser.storage.local.set(items) as Promise<void>,
});

/** Adapter health, so the popup can say an adapter needs updating. */
const health = new Map<string, { state: string; version: number; at: string }>();

const broadcast = (message: unknown): void => {
  // A popup that is not open is not an error, so the rejection is swallowed.
  void browser.runtime.sendMessage(message).catch(() => undefined);
};

const handleTurn = async (message: Extract<ExtensionMessage, { type: 'turn:captured' | 'turn:dom' }>) => {
  const adapter = adapterById(message.adapterId);
  if (!adapter) return;

  /*
   * An adapter that has moved on from the version that captured this turn
   * cannot be trusted to have read it correctly. Dropping the turn loses a
   * count; keeping it risks a wrong one, and a wrong one is worse.
   */
  if (adapter.version !== message.adapterVersion) return;

  const current = await settings.get();
  const stored = await priceTurn(message.turn, adapter, dataset, current);

  /*
   * The same turn can arrive twice, once from the network and once from the
   * fallback that watches the page. The id is the adapter's stable key, so the
   * second write replaces the first rather than doubling the total. The
   * network one is written last where both arrive, because it knows more.
   */
  if (message.type === 'turn:dom') {
    const existing = await getEvents();
    if (existing.some((one) => one.id === stored.id)) return;
  }

  await putEvent(stored);
  broadcast({ type: 'events:changed' });
};

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  const message = raw as ExtensionMessage & { type: string };

  if (message.type === 'turn:captured' || message.type === 'turn:dom') {
    void handleTurn(message as Extract<ExtensionMessage, { type: 'turn:captured' }>);
    return false;
  }

  if (message.type === 'adapter:health') {
    const one = message as Extract<ExtensionMessage, { type: 'adapter:health' }>;
    health.set(one.adapterId, {
      state: one.health,
      version: one.adapterVersion,
      at: new Date().toISOString(),
    });
    return false;
  }

  if (message.type === 'summary:get') {
    void (async () => {
      const current = await settings.get();
      const events = await getEvents();
      const pairs = events.map((one) => ({ event: one.event, estimate: one.estimate }));
      sendResponse({
        settings: current,
        datasetVersion: dataset.version,
        total: aggregate(pairs, 'all')[0] ?? null,
        byDay: aggregate(pairs, 'day'),
        byModel: aggregate(pairs, 'model'),
        bySurface: aggregate(pairs, 'surface'),
        health: Object.fromEntries(health),
        count: events.length,
      });
    })();
    return true;
  }

  if (message.type === 'settings:set') {
    void (async () => {
      const next = await settings.set((message as { patch: Partial<Settings> }).patch);
      // A change to the region or the water scope re-prices everything, so the
      // popup is never showing two turns costed by different rules.
      await repriceAll(next, true);
      sendResponse(next);
      broadcast({ type: 'events:changed' });
    })();
    return true;
  }

  if (message.type === 'events:forget') {
    void (async () => {
      const { forgetEverything } = await import('../lib/storage.js');
      await forgetEverything();
      sendResponse({ ok: true });
      broadcast({ type: 'events:changed' });
    })();
    return true;
  }

  return false;
});

/**
 * Re-prices stored events.
 *
 * Run on startup when the dataset version has moved, and whenever a setting
 * that affects pricing changes. The tokens were stored, so nothing is
 * recounted. A one time notice tells the reader the numbers moved, because a
 * total that changes without explanation is a total nobody trusts.
 */
const repriceAll = async (current: Settings, force = false): Promise<number> => {
  const lastSeen = await readMeta<string>('datasetVersion');
  if (!force && lastSeen === dataset.version) return 0;

  const events = await getEvents();
  const { updated, changed } = force
    ? {
        updated: events.map((one) => ({ ...one, datasetVersion: '' })),
        changed: events.length,
      }
    : reprice(events, dataset, current);

  const priced = force ? reprice(updated, dataset, current).updated : updated;
  for (const one of priced) await putEvent(one);

  await writeMeta('datasetVersion', dataset.version);
  if (changed > 0 && !force) {
    await writeMeta('repricedNotice', {
      at: new Date().toISOString(),
      count: changed,
      version: dataset.version,
    });
  }
  return changed;
};

browser.runtime.onInstalled.addListener(() => {
  void (async () => {
    const current = await settings.get();
    await repriceAll(current);
    // Once a day: prune anything past the retention setting. Nothing is sent
    // anywhere by this; it only deletes.
    await browser.alarms.create('buoa:daily', { periodInMinutes: 60 * 24 });
  })();
});

browser.runtime.onStartup?.addListener(() => {
  void (async () => {
    await repriceAll(await settings.get());
  })();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'buoa:daily') return;
  void (async () => {
    const current = await settings.get();
    const removed = await prune(current.retentionDays, new Date());
    if (removed > 0) broadcast({ type: 'events:changed' });
  })();
});

export default defineBackground(() => {
  // Everything is registered above, at module scope, because a service worker
  // can be woken by an event before this callback runs.
  void countEvents().then((count) => {
    if (count === 0) void settings.set(DEFAULT_SETTINGS);
  });
});
