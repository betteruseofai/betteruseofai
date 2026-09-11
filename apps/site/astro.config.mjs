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
