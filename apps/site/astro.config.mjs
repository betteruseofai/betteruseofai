// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

/**
 * Static output, no adapter, no server. The whole site is files on a CDN,
 * which is the only shape that lets the privacy page say what it says.
 */
export default defineConfig({
  site: 'https://betteruseofai.org',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },

  integrations: [
    mdx(),
    preact({ compat: false }),
    sitemap({
      // Draft pages carry noindex, and the design sheet is an internal
      // reference, so neither belongs in a sitemap.
      filter: (page) => !page.includes('/design'),
    }),
  ],

  /*
   * Astro hashes every inline script and style it emits and writes them into a
   * meta content security policy on each page.
   *
   * This is not optional decoration. The islands architecture bootstraps with
   * an inline script, so a strict policy without hashes blocks hydration and
   * the calculator silently does nothing at all. That is how this was found:
   * the browser tests failed on twelve policy violations across ten pages.
   *
   * public/_headers still carries a policy as a real header, for the
   * directives a meta tag cannot express, frame-ancestors among them.
   */
  security: {
    csp: {
      directives: [
        "default-src 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'none'",
        "base-uri 'none'",
        "manifest-src 'self'",
      ],
      scriptDirective: {
        // The analytics beacon, and nothing else. Named here as well as in the
        // header, so the two cannot drift apart unnoticed.
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
      },
      styleDirective: {
        // A style attribute on an element is not covered by a style-src hash,
        // and the range bars set their own stops per element, so those cannot
        // move into a stylesheet. A style attribute cannot run script; what it
        // exposes is CSS, on pages with nothing secret in the DOM.
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },

  markdown: {
    // Plain mono code blocks. Shiki writes inline styles on every token, which
    // would mean either a loose style-src or a few hundred hashes in the CSP.
    syntaxHighlight: false,

  },

  vite: {
    build: {
      // Small enough to inline is small enough to be a hash in the CSP we do
      // not want to maintain. Keep everything as a file.
      assetsInlineLimit: 0,
    },
  },

  devToolbar: { enabled: false },
});
