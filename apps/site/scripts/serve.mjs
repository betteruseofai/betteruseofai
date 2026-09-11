/**
 * A static server for the built site.
 *
 * Shared by the screenshot script and the browser tests, and pointed at dist
 * rather than the dev server on purpose. The dev server rewrites paths and
 * inlines styles, so testing against it means testing something other than
 * what ships.
 *
 * It also applies the headers from public/_headers, so the content security
 * policy is the real one during a test rather than an aspiration in a file
 * nobody reads until the first deploy.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Reads Cloudflare's _headers format. Only what we use: a path pattern on a
 * column-zero line, then indented `Name: value` lines under it.
 */
export const readHeaders = (dist) => {
  const path = join(dist, '_headers');
  if (!existsSync(path)) return [];

  const rules = [];
  let current = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    const at = line.indexOf(':');
    if (at > 0 && current) {
      current.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return rules;
};

const matches = (pattern, pathname) => {
  // Only the two shapes the file uses: a trailing star, or an exact path.
  // Rules naming a full address (the pages.dev noindex) never match here.
  if (pattern.includes('://')) return false;
  if (pattern.endsWith('/*')) return pathname.startsWith(pattern.slice(0, -1));
  if (pattern === '/*') return true;
  return pattern === pathname;
};

/** Starts the server on a free port. Returns { url, close }. */
export const serve = (dist) =>
  new Promise((resolve) => {
    const rules = readHeaders(dist);

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let path = join(dist, decodeURIComponent(url.pathname));

      // Astro is set to build.format "file", so /about is about.html.
      if (!existsSync(path) || statSync(path).isDirectory()) {
        if (existsSync(`${path}.html`)) path = `${path}.html`;
        else if (existsSync(join(path, 'index.html'))) path = join(path, 'index.html');
      }

      const headers = {};
      for (const rule of rules) {
        if (!matches(rule.pattern, url.pathname)) continue;
        for (const [name, value] of rule.headers) headers[name] = value;
      }

      if (!existsSync(path) || statSync(path).isDirectory()) {
        const missing = join(dist, '404.html');
        if (existsSync(missing)) {
          response.writeHead(404, { ...headers, 'content-type': TYPES['.html'] });
          createReadStream(missing).pipe(response);
          return;
        }
        response.writeHead(404, headers).end('not here');
        return;
      }

      response.writeHead(200, {
        ...headers,
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
      });
      createReadStream(path).pipe(response);
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
