import { defineConfig } from 'vitest/config';

/** The unit run. Tests that need a browser are in test/browser and run with test:browser. */
export default defineConfig({
  test: {
    name: 'cli-ts',
    include: ['test/**/*.test.ts'],
    exclude: ['test/browser/**', '**/node_modules/**'],
    environment: 'node',
    testTimeout: 20000,
  },
});
