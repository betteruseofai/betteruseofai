import { chatgptAdapter } from './chatgpt.js';
import { claudeAdapter } from './claude.js';
import { geminiAdapter } from './gemini.js';
import { localAdapter } from './local.js';
import type { SiteAdapter } from './types.js';

export * from './types.js';
export { claudeAdapter, sseEvents } from './claude.js';
export { chatgptAdapter } from './chatgpt.js';
export { geminiAdapter, harvestStrings, decodeEnvelope } from './gemini.js';
export { localAdapter } from './local.js';

/**
 * The adapters, in the order they are offered a page.
 *
 * The local one is last because its host patterns are the loosest, and a cloud
 * site must never fall through to it.
 */
export const ADAPTERS: SiteAdapter[] = [claudeAdapter, chatgptAdapter, geminiAdapter, localAdapter];

const ESCAPE = /[.+?^${}()|[\]\\]/g;

const globToRegExp = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(ESCAPE, '\\$&').replace(/\*/g, '.*')}$`);

/** The adapter that claims this address, or null. */
export const adapterFor = (url: string): SiteAdapter | null =>
  ADAPTERS.find((adapter) => adapter.matches.some((pattern) => globToRegExp(pattern).test(url))) ??
  null;

export const adapterById = (id: string): SiteAdapter | null =>
  ADAPTERS.find((adapter) => adapter.id === id) ?? null;
