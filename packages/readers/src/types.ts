import type { UsageEvent } from '@betteruseofai/core';

/**
 * Everything in this package reads files that are already on the user's disk.
 * Nothing here opens a socket, and nothing here writes to the transcripts it
 * reads.
 */

export interface ReaderOptions {
  /**
   * Where to look. Defaults to the standard location for the tool, which can
   * also be overridden by an environment variable so the fixtures can be run
   * against without touching a real home directory.
   */
  dir?: string;
  /** Only return events at or after this ISO timestamp. */
  since?: string;
  /** Only return events at or before this ISO timestamp. */
  until?: string;
  /** Restrict to one session. */
  sessionId?: string;
}

export interface ReaderWarning {
  file: string;
  line?: number;
  /** Plain English, shown by the doctor command. */
  message: string;
}

export interface ReaderResult {
  events: UsageEvent[];
  /**
   * Lines we skipped and why. A transcript with a corrupt line still yields the
   * rest of its events, but the skip is reported rather than swallowed.
   */
  warnings: ReaderWarning[];
  /** Files actually read, for the doctor command. */
  files: string[];
  /**
   * Assistant turns we deliberately did not count: synthetic messages, error
   * rows, and duplicate content blocks of a message already seen.
   */
  skipped: { synthetic: number; apiError: number; duplicate: number; noUsage: number };
}

export interface Reader {
  readonly id: string;
  readonly surface: string;
  /** Where this reader looks by default, for the doctor command. */
  defaultDir(): string;
  read(options?: ReaderOptions): Promise<ReaderResult>;
}

/**
 * The state a caller keeps between incremental reads of one transcript, so a
 * status line can parse only what has been appended since it last looked.
 */
export interface IncrementalState {
  /** Byte offset we have already consumed. */
  offset: number;
  /**
   * Keys of messages already counted. Kept so a message that is rewritten in a
   * later chunk replaces the earlier copy rather than being added to it.
   */
  seen: Record<string, number>;
}

export const emptyIncrementalState = (): IncrementalState => ({ offset: 0, seen: {} });
