import { defineConfig } from 'vitest/config';

/**
 * The site's browser run.
 *
 * One file at a time, like the extension's, because a browser launch is slow
 * and a suite that flakes under load teaches people to ignore failures. It is
 * a separate task from the copy lint for the same reason.
 */
export default defineConfig({
  test: {
    name: 'site',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 180000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
