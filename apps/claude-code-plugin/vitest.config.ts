import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'plugin', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 30000 },
});
