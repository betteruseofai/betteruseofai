import type { AdapterHealth, SiteAdapter } from '../adapters/types.js';

/**
 * Whether each site still looks the way its adapter expects.
 *
 * Kept in storage rather than in the background worker's memory, because the
 * browser stops an idle worker after about thirty seconds and the popup then
 * found nothing. A record is ignored once its adapter's version moves on, so a
 * fixed adapter starts clean.
 */

export const HEALTH_KEY = 'adapterHealth';

export interface HealthRecord {
  state: AdapterHealth;
  version: number;
  at: string;
}

export type HealthStore = Record<string, HealthRecord>;

export const recordHealth = (
  store: HealthStore,
  adapterId: string,
  version: number,
  state: AdapterHealth,
  at: string,
): HealthStore => ({ ...store, [adapterId]: { state, version, at } });

/** Only what the adapters as they are now reported. */
export const currentHealth = (store: HealthStore, adapters: SiteAdapter[]): HealthStore =>
  Object.fromEntries(
    Object.entries(store).filter(([id, record]) =>
      adapters.some((adapter) => adapter.id === id && adapter.version === record.version),
    ),
  );

/**
 * A sign-in page has no composer, which the probe would otherwise read as a
 * site that changed under us. The address or a password box gives it away.
 */
export const looksSignedOut = (path: string, document: Pick<Document, 'querySelector'>): boolean =>
  /\/(?:login|logout|auth|signin|sign-in|signup|sign-up)(?:\/|$)/i.test(path) ||
  document.querySelector('input[type="password"]') !== null;

const SITE_NAMES: Record<string, string> = {
  'claude-web': 'claude.ai',
  'chatgpt-web': 'chatgpt.com',
  'gemini-web': 'gemini.google.com',
  'local-webui': 'the local model page',
};

/** What the popup says about a site that doesn't look right, one line each. */
export const healthNotes = (store: HealthStore): string[] =>
  Object.entries(store).flatMap(([id, record]) => {
    const site = SITE_NAMES[id] ?? id;
    if (record.state === 'unsupported') {
      return [
        `${site} no longer looks the way we expect. Turns there may go uncounted until we update the extension.`,
      ];
    }
    if (record.state === 'degraded') {
      return [
        `We can't find the model picker on ${site}, so a turn there shows an unknown model whenever the site doesn't name it.`,
      ];
    }
    // ok, and signed out, which is not something wrong with the site.
    return [];
  });
