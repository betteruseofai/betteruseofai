import type { Surface } from '@betteruseofai/core';

/**
 * What a site adapter has to provide.
 *
 * The awkward truth about this whole approach is that these sites change their
 * endpoints and their markup without warning, and an adapter that has quietly
 * gone stale reports wrong numbers. Wrong numbers are worse than no numbers,
 * so every adapter carries a version and a health probe, and the interface
 * says "this adapter needs an update" rather than showing a figure it cannot
 * stand behind.
 *
 * Nothing in an adapter stores prompt text. Adapters read what they need to
 * count tokens and identify a model, and the text is dropped.
 */

export type AdapterHealth = 'ok' | 'degraded' | 'unsupported';

export interface CapturedTurn {
  /** Stable within a conversation, so a repeat does not double count. */
  key: string;
  conversationId: string | null;
  /** Whatever string the site gave us, kept verbatim. Never guessed at. */
  modelRaw: string | null;
  /** Where the model string came from, which decides how much to trust it. */
  modelSource: 'response' | 'request' | 'header' | 'picker' | 'unknown';
  inputText: string;
  outputText: string;
  /** Set when the site itself reports a count, which beats any estimate. */
  reportedTokens?: {
    input?: number;
    output?: number;
    cachedRead?: number;
    thinking?: number | null;
  };
  /** True when the site can hide reasoning and did not disclose the count. */
  thinkingUndisclosed: boolean;
  at: string;
}

export interface ParsedRequest {
  conversationId: string | null;
  modelRaw: string | null;
  modelSource: CapturedTurn['modelSource'];
  inputText: string;
}

export interface ParsedStream {
  modelRaw: string | null;
  modelSource: CapturedTurn['modelSource'];
  outputText: string;
  reportedTokens?: CapturedTurn['reportedTokens'];
  thinkingUndisclosed: boolean;
}

export interface SiteAdapter {
  id: string;
  surface: Surface;
  hosting: 'cloud' | 'local';
  /**
   * Bumped whenever the site changes shape under us. The stored health state is
   * cleared when the version moves, so a fixed adapter starts clean.
   */
  version: number;
  /** Host patterns this adapter claims. */
  matches: string[];
  /** The provider whose tokenizer ratio applies. */
  provider: string;

  /** True when this request is the one that carries a conversation turn. */
  shouldCapture(url: string, method: string): boolean;

  /** Reads the outgoing request. Returns null when the body is not what we expected. */
  parseRequest(body: string, headers: Record<string, string>, url: string): ParsedRequest | null;

  /**
   * Reads the streamed response.
   *
   * Given the whole body as text, because a partial parse of a stream that
   * ended early would produce a short count, and a short count is a wrong
   * count.
   */
  parseStream(body: string): ParsedStream | null;

  /** Pulls a conversation id out of the address bar, for the DOM fallback. */
  conversationIdFromUrl(url: string): string | null;

  /** Reads the model out of the page, for when the network did not say. */
  readSelectedModel(document: Document): string | null;

  /** Where the composer hint attaches, and what is in the box. */
  findComposer(document: Document): HTMLElement | null;
  readDraft(document: Document): string;

  /**
   * Checks the page still looks the way this adapter expects.
   *
   * Run on load. If the markers have gone the adapter reports unsupported and
   * the extension shows nothing rather than guessing.
   */
  healthProbe(document: Document): AdapterHealth;
}

/** What the isolated content script sends to the background. */
export interface TurnMessage {
  type: 'turn:captured' | 'turn:dom';
  adapterId: string;
  adapterVersion: number;
  turn: CapturedTurn;
}

export interface HealthMessage {
  type: 'adapter:health';
  adapterId: string;
  adapterVersion: number;
  health: AdapterHealth;
  detail?: string;
}

export type ExtensionMessage = TurnMessage | HealthMessage;
