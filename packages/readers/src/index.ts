/**
 * Node-only readers for local agent transcripts.
 *
 * These are kept out of @betteruseofai/core so that the engine stays free of
 * Node APIs and can ship into a browser extension unchanged.
 */

export * from './types.js';
export { readJsonl, readJsonlSince, walk, exists } from './jsonl.js';
export type { JsonLine } from './jsonl.js';
export {
  readClaudeCode,
  readClaudeCodeIncremental,
  claudeCodeReader,
  defaultClaudeDir,
  CLAUDE_CODE_SURFACE,
} from './claude-code.js';
export {
  readCodex,
  readCodexRollout,
  codexReader,
  defaultCodexDir,
  CODEX_SURFACE,
  CODEX_TOKENS_FROM,
} from './codex.js';

import { claudeCodeReader } from './claude-code.js';
import { codexReader } from './codex.js';
import type { Reader, ReaderOptions, ReaderResult } from './types.js';

/** Every reader that is ready. The Gemini CLI one lands in a later phase. */
export const readers: Reader[] = [claudeCodeReader, codexReader];

/** Reads every source and merges the events into one timeline. */
export const readAll = async (
  options: ReaderOptions & { only?: string[] } = {},
): Promise<ReaderResult> => {
  const wanted = options.only ? readers.filter((r) => options.only?.includes(r.id)) : readers;
  const results = await Promise.all(wanted.map((reader) => reader.read(options)));

  return {
    events: results
      .flatMap((result) => result.events)
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1)),
    warnings: results.flatMap((result) => result.warnings),
    files: results.flatMap((result) => result.files),
    skipped: results.reduce(
      (acc, result) => ({
        synthetic: acc.synthetic + result.skipped.synthetic,
        apiError: acc.apiError + result.skipped.apiError,
        duplicate: acc.duplicate + result.skipped.duplicate,
        noUsage: acc.noUsage + result.skipped.noUsage,
      }),
      { synthetic: 0, apiError: 0, duplicate: 0, noUsage: 0 },
    ),
  };
};
