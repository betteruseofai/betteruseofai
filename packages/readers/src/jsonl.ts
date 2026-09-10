import { createReadStream } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * Small helpers for walking directories of JSON lines files.
 *
 * The transcripts get large, so nothing here reads a whole file into memory
 * unless it has to, and the incremental reader exists because the Claude Code
 * status line is debounced at 300 ms and has to answer in tens of milliseconds.
 */

export interface JsonLine {
  /** Line number, counting from one, for a warning that names the spot. */
  line: number;
  value: unknown;
  /** Set when the line could not be parsed. */
  error?: string;
}

/** Streams a JSON lines file, yielding a parse error rather than throwing on it. */
export async function* readJsonl(path: string): AsyncGenerator<JsonLine> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let number = 0;
  for await (const raw of lines) {
    number += 1;
    const text = raw.trim();
    if (text === '') continue;
    try {
      yield { line: number, value: JSON.parse(text) };
    } catch (cause) {
      yield { line: number, value: null, error: cause instanceof Error ? cause.message : 'unparseable' };
    }
  }
}

/**
 * Reads the bytes appended to a file since a given offset and parses them as
 * JSON lines.
 *
 * A partial trailing line is left for next time: the offset returned points at
 * the start of it, so the caller picks it up once the writer has finished. If
 * the file has shrunk it was rotated or replaced, so we start again from zero.
 */
export const readJsonlSince = async (
  path: string,
  offset: number,
): Promise<{ lines: JsonLine[]; offset: number; restarted: boolean }> => {
  const info = await stat(path);
  let start = offset;
  let restarted = false;
  if (info.size < offset) {
    start = 0;
    restarted = true;
  }
  if (info.size === start) return { lines: [], offset: start, restarted };

  const handle = await open(path, 'r');
  try {
    const length = info.size - start;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    const text = buffer.toString('utf8');

    const lastBreak = text.lastIndexOf('\n');
    const complete = lastBreak === -1 ? '' : text.slice(0, lastBreak);
    const consumed = lastBreak === -1 ? 0 : Buffer.byteLength(text.slice(0, lastBreak + 1), 'utf8');

    const lines: JsonLine[] = [];
    let number = 0;
    for (const raw of complete.split('\n')) {
      number += 1;
      const trimmed = raw.trim();
      if (trimmed === '') continue;
      try {
        lines.push({ line: number, value: JSON.parse(trimmed) });
      } catch (cause) {
        lines.push({
          line: number,
          value: null,
          error: cause instanceof Error ? cause.message : 'unparseable',
        });
      }
    }
    return { lines, offset: start + consumed, restarted };
  } finally {
    await handle.close();
  }
};

/** Every file under a directory tree whose name matches, sorted for determinism. */
export const walk = async (dir: string, matches: (name: string) => boolean): Promise<string[]> => {
  const found: string[] = [];
  const visit = async (current: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && matches(entry.name)) found.push(path);
    }
  };
  await visit(dir);
  return found.sort();
};

export const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};
