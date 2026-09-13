import { resolve } from 'node:path';

import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

/**
 * Extension build.
 *
 * The permissions list is the most important thing in this file, so it is
 * worth reading it as a claim rather than as configuration. We ask for
 * storage, unlimited storage and alarms, and for the three sites the adapters
 * handle. We do not ask for tabs, webRequest, scripting, or any-url access,
 * and there is no host permission for localhost until somebody switches local
 * detection on, at which point it is requested rather than assumed.
 *
 * Nothing here declares a remote script, a content security policy exception,
 * or an externally connectable page. The extension talks to nothing.
 */
export default defineConfig({
  srcDir: 'src',
  outDir: '.output',

  /*
   * Manifest v3 on Firefox too, not the v2 the build tool defaults to.
   * Mozilla is retiring v2, and the page-world script this extension depends
   * on needs Firefox 128 or newer, which is what the minimum version below
   * pins. Shipping v2 would mean a second code path to keep honest.
   */
  manifestVersion: 3,

  manifest: ({ browser }) => ({
    name: 'Better Use of AI',
    description:
      'What your chat costs in energy, water and carbon, worked out on your own machine. Nothing is sent anywhere.',
    version: '0.0.0',
    homepage_url: 'https://betteruseofai.org',

    /*
     * The mark, in the one tone that reads on both of Chrome's toolbars. A
     * manifest icon is a fixed image with no way to know which toolbar it is
     * on; tokens.json chose the tone and the tokens test asserts the contrast.
     * Firefox can be told, so it gets ink and paper through theme_icons.
     */
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },

    permissions: ['storage', 'unlimitedStorage', 'alarms'],

    host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://gemini.google.com/*',
    ],

    // Asked for only when somebody turns local model detection on. A tool that
    // promises to stay local should not help itself to localhost by default.
    optional_host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],

    // The page-world script has to be listed, or the browser will not let the
    // content script inject it.
    web_accessible_resources: [
      {
        resources: ['interceptor.js'],
        matches: [
          'https://claude.ai/*',
          'https://chatgpt.com/*',
          'https://chat.openai.com/*',
          'https://gemini.google.com/*',
          'http://localhost/*',
          'http://127.0.0.1/*',
        ],
      },
    ],

    ...(browser === 'firefox'
      ? {
          // Light is the icon for a dark theme and dark for a light one, in
          // Firefox's naming: the colour of the icon, not of the toolbar.
          theme_icons: [16, 32, 48, 128].map((size) => ({
            light: `icon/${size}-paper.png`,
            dark: `icon/${size}-ink.png`,
            size,
          })),
          browser_specific_settings: {
            gecko: {
              id: 'betteruseofai@betteruseofai.org',
              // Page-world scripts need this, and AMO rejects the zip without it.
              strict_min_version: '128.0',
              /*
               * Firefox asks every add-on to declare what it collects, and the
               * answer here is nothing. It belongs inside gecko rather than at
               * the top level: web-ext lint said so, and a declaration in the
               * wrong place is the same as no declaration.
               */
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),

  vite: () => ({
    plugins: [preact()],
    resolve: {
      alias: {
        '@betteruseofai/core': resolve(__dirname, '../../packages/core/src/index.ts'),
        '@betteruseofai/tokenizers': resolve(__dirname, '../../packages/tokenizers/src/index.ts'),
        '@betteruseofai/ui-hint': resolve(__dirname, '../../packages/ui-hint/src/index.ts'),
        '@betteruseofai/tokens': resolve(__dirname, '../../packages/tokens'),
        /*
         * The rank table is two and a half megabytes and a service worker is
         * built as one file, so leaving this reachable put the whole table in
         * the worker. It ships as a packaged file instead, and the background
         * points the tokenizer at it.
         */
        'js-tiktoken/ranks/o200k_base': resolve(__dirname, 'src/lib/ranks-not-bundled.ts'),
      },
    },
    build: {
      // No minification. A reviewer should be able to read the interceptor,
      // and the size difference is not worth the suspicion.
      minify: false,
    },
  }),
});
