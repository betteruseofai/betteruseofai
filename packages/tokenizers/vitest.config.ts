import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'tokenizers', include: ['test/**/*.test.ts'], environment: 'node' },
});
