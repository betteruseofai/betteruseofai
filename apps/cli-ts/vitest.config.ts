import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'cli-ts', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 20000 },
});
