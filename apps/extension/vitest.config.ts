import { defineConfig } from 'vitest/config';

/**
 * The unit tests. The end to end run is deliberately excluded: it launches a
 * browser, and sharing a machine with seven other packages' test runs made it
 * fail about one time in four. Run it with `pnpm test:e2e`, which has the
 * machine to itself.
 */
export default defineConfig({
  test: {
    name: 'extension',
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e.test.ts', '**/node_modules/**'],
    environment: 'node',
  },
});
