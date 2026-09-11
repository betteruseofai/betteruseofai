import { defineConfig } from 'vitest/config';

/**
 * The end to end run: the built extension, loaded into a real browser.
 *
 * One file at a time, one test at a time, and a generous timeout, because a
 * browser launch is slow and a flaky test teaches people to ignore failures.
 */
export default defineConfig({
  test: {
    name: 'extension-e2e',
    include: ['test/e2e.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 180000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
