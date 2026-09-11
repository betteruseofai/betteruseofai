import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'ui-hint', include: ['test/**/*.test.ts'], environment: 'happy-dom' },
});
