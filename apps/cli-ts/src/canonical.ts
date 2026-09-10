import { canonicalNumber } from '@betteruseofai/core';

/**
 * Canonical JSON, which is the contract between this tool and the Python one.
 *
 * The rules, all of which the Python side has to follow:
 *
 *   1. Object keys sorted by code point.
 *   2. Two space indent, one trailing newline, and a line feed for every break.
 *   3. Every number written through canonicalNumber: six significant digits,
 *      shortest round-tripping form, no trailing ".0", no padded exponent.
 *   4. Undefined values dropped; null kept, because null means "we do not know"
 *      and dropping it would turn absence into silence.
 *
 * The payload header carries a generatedWith field that names the
 * implementation. The parity check strips it before comparing, so the two tools
 * can identify themselves without breaking the diff.
 */

export const SCHEMA_VERSION = 1;

export interface PayloadHeader {
  schemaVersion: number;
  datasetVersion: string;
  datasetSha256: string;
  generatedWith: string;
  generatedAt: string;
}

const escapeString = (value: string): string => JSON.stringify(value);

const write = (value: unknown, indent: string): string => {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return canonicalNumber(value);
    case 'string':
      return escapeString(value);
    case 'undefined':
      return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = indent + '  ';
    const items = value.map((item) => `${inner}${write(item, inner)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (entries.length === 0) return '{}';
    const inner = indent + '  ';
    const parts = entries.map(([key, item]) => `${inner}${escapeString(key)}: ${write(item, inner)}`);
    return `{\n${parts.join(',\n')}\n${indent}}`;
  }

  return 'null';
};

export const canonicalJson = (value: unknown): string => `${write(value, '')}\n`;

/** Strips the field that is allowed to differ between the two implementations. */
export const stripGeneratedWith = (payload: Record<string, unknown>): Record<string, unknown> => {
  const copy = { ...payload };
  const header = copy['header'];
  if (header && typeof header === 'object') {
    const clean = { ...(header as Record<string, unknown>) };
    delete clean['generatedWith'];
    delete clean['generatedAt'];
    copy['header'] = clean;
  }
  return copy;
};
