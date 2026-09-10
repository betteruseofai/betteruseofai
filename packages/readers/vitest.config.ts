import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'readers', include: ['test/**/*.test.ts'], environment: 'node' },
});
