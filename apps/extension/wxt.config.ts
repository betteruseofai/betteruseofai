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

  manifest: ({ browser }) => ({
    name: 'Better Use of AI',
    description:
      'What your chat costs in energy, water and carbon, worked out on your own machine. Nothing is sent anywhere.',
    version: '0.0.0',
    homepage_url: 'https://betteruseofai.org',

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
          browser_specific_settings: {
            gecko: {
              id: 'betteruseofai@betteruseofai.org',
              // Page-world scripts need this, and AMO rejects the zip without it.
              strict_min_version: '128.0',
            },
          },
          // Firefox asks every add-on to declare what it collects. The answer
          // is nothing, and this is where that is said in machine readable form.
          data_collection_permissions: { required: ['none'] },
        }
      : {}),
  }),

  vite: () => ({
    plugins: [preact()],
    resolve: {
      alias: {
        '@betteruseofai/core': resolve(__dirname, '../../packages/core/src/index.ts'),
        '@betteruseofai/tokenizers': resolve(__dirname, '../../packages/tokenizers/src/index.ts'),
        '@betteruseofai/tokens': resolve(__dirname, '../../packages/tokens'),
      },
    },
    build: {
      // No minification. A reviewer should be able to read the interceptor,
      // and the size difference is not worth the suspicion.
      minify: false,
    },
  }),
});
