import { defineConfig } from 'vitest/config';

/**
 * The command line tool's browser run: the dashboard page drawn in Chromium.
 * Its own task and its own CI job, because the CI matrix installs no browser
 * and a launch beside the unit tests is slow and flaky.
 */
export default defineConfig({
  test: {
    name: 'cli-ts-browser',
    include: ['test/browser/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    fileParallelism: false,
  },
});
