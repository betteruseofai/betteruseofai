import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The claim this whole project rests on, checked against the built extension
 * rather than the source.
 *
 * "Nothing leaves your machine" is easy to write in a readme and easy to break
 * by accident: one analytics snippet in a dependency, one well-meaning version
 * check, and it stops being true. So this reads the files that actually ship
 * and fails on any way of reaching the network that is not on the list below,
 * with the reason it is allowed.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const built = join(root, '.output', 'chrome-mv3');

/** Every network-capable call a browser offers. */
const CALLS = [
  /\bfetch\s*\(/g,
  /\bXMLHttpRequest\b/g,
  /\bWebSocket\b/g,
  /\bEventSource\b/g,
  /\bsendBeacon\b/g,
  /\bnavigator\.connection\b/g,
  /\bimportScripts\s*\(/g,
];

/**
 * The exceptions, each with the reason it is allowed. Anything not on this
 * list is a failure, and adding to this list should be a deliberate argument
 * rather than a quick fix.
 */
const ALLOWED: Array<{ file: RegExp; call: RegExp; most: number; why: string }> = [
  {
    file: /^background\.js$/,
    call: /\bfetch\s*\(/g,
    most: 1,
    why: 'Reads the o200k rank table out of a file packaged inside the extension.',
  },
  {
    file: /^content-scripts\/sites\.js$/,
    call: /\bfetch\s*\(/g,
    most: 1,
    why: "WXT's own injectScript, reading our interceptor from the extension, on Manifest V2.",
  },
  {
    file: /^interceptor\.js$/,
    call: /\bXMLHttpRequest\b/g,
    most: 6,
    why: 'The wrapper itself. Reading the page traffic is what this file is for.',
  },
  {
    // Content hashed, so matched by shape.
    file: /^chunks\/browser-[\w-]+\.js$/,
    call: /\bfetch\s*\(/g,
    most: 1,
    why: "Vite's modulepreload polyfill, warming the extension's own chunks. The address is always one of ours.",
  },
];

/**
 * The code, without its comments. The worker's own header explains this test
 * by naming the calls it looks for, and a dependency's documentation links to
 * MDN; neither is a code path. Block comments go, and so do lines that are
 * only a comment. A URL inside a string on a line of code stays.
 */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const jsFiles = (dir: string, prefix = ''): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsFiles(path, `${prefix}${name}/`);
    return name.endsWith('.js') ? [`${prefix}${name}`] : [];
  });
};

beforeAll(() => {
  if (!existsSync(join(built, 'manifest.json'))) {
    execFileSync('npx', ['wxt', 'build'], { cwd: root, shell: process.platform === 'win32' });
  }
});

describe('the built extension', () => {
  it('reaches the network only in the two places we can account for', () => {
    const unexplained: string[] = [];

    for (const file of jsFiles(built)) {
      const source = codeOnly(readFileSync(join(built, file), 'utf8'));
      for (const call of CALLS) {
        call.lastIndex = 0;
        const hits = source.match(call)?.length ?? 0;
        if (hits === 0) continue;

        const allowance = ALLOWED.find(
          (one) => one.file.test(file) && one.call.source === call.source,
        );
        if (!allowance) {
          unexplained.push(`${file}: ${hits} x ${call.source}`);
        } else if (hits > allowance.most) {
          unexplained.push(
            `${file}: ${hits} x ${call.source}, more than the ${allowance.most} allowed for: ${allowance.why}`,
          );
        }
      }
    }

    expect(unexplained).toEqual([]);
  });

  it('names no remote address anywhere in what ships', () => {
    const remote: string[] = [];
    // Anything that is not one of the sites the adapters read, or a link a
    // person might click. An address that gets requested is the worry.
    const addresses = /https?:\/\/[a-z0-9.-]+/gi;
    const expected = new Set([
      'https://claude.ai',
      'https://chatgpt.com',
      'https://chat.openai.com',
      'https://gemini.google.com',
      'http://localhost',
      'http://127.0.0.1',
      // Sources and links. These are printed, never requested.
      'https://betteruseofai.org',
      'https://arxiv.org',
      'https://epoch.ai',
      'https://ember-energy.org',
      // Ember's yearly CSV, which the region rows cite, is served from a
      // Google Cloud bucket. A source address, printed and never requested.
      'https://storage.googleapis.com',
      // The WRI guidance PDF the water factors cite. Printed, never requested.
      'https://files.wri.org',
      'https://huggingface.co',
      'https://joss.theoj.org',
      'https://mistral.ai',
      'https://blog.samaltman.com',
      'https://googleblog.blogspot.com',
      'https://www.epa.gov',
      'https://www.gov.uk',
      'https://cea.nic.in',
      'https://waterwise.org.uk',
      'https://energysavingtrust.org.uk',
      'https://www.ofgem.gov.uk',
      'https://www.ledvance.com',
      'https://www.bipm.org',
      'https://www.nist.gov',
      'https://docs.claude.com',
      'https://ai.google.dev',
      'https://github.com',
      'https://json-schema.org',
      // An XML namespace, not an address. Preact writes it when it makes an
      // svg element, and nothing ever requests it.
      'http://www.w3.org',
    ]);

    for (const file of jsFiles(built)) {
      const source = codeOnly(readFileSync(join(built, file), 'utf8'));
      for (const found of source.match(addresses) ?? []) {
        if (!expected.has(found.toLowerCase())) remote.push(`${file}: ${found}`);
      }
    }

    expect([...new Set(remote)]).toEqual([]);
  });

  it('asks for no permission beyond what the adapters need', () => {
    const manifest = JSON.parse(readFileSync(join(built, 'manifest.json'), 'utf8'));
    expect(manifest.permissions.sort()).toEqual(['alarms', 'storage', 'unlimitedStorage']);
    for (const forbidden of ['tabs', 'webRequest', 'webRequestBlocking', 'scripting', 'cookies', 'history']) {
      expect(manifest.permissions, forbidden).not.toContain(forbidden);
    }
    expect(manifest.host_permissions).not.toContain('<all_urls>');
    expect(manifest.host_permissions.every((one: string) => !one.includes('*://*'))).toBe(true);
  });

  it('keeps localhost optional, so it is asked for rather than assumed', () => {
    const manifest = JSON.parse(readFileSync(join(built, 'manifest.json'), 'utf8'));
    expect(manifest.host_permissions.some((one: string) => one.includes('localhost'))).toBe(false);
    expect(manifest.optional_host_permissions.some((one: string) => one.includes('localhost'))).toBe(
      true,
    );
  });

  it('ships the rank table as a file rather than inside the worker', () => {
    const worker = statSync(join(built, 'background.js')).size;
    const table = statSync(join(built, 'o200k_base.json')).size;
    // The worker reloads on every wake, so its size is the one that matters.
    expect(worker).toBeLessThan(400 * 1024);
    expect(table).toBeGreaterThan(1024 * 1024);
    expect(relative(built, join(built, 'o200k_base.json'))).toBe('o200k_base.json');
  });
});
