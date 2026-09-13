import { defineConfig } from 'vitest/config';

/** The site's unit tests, which need no browser and no build. */
export default defineConfig({
  test: { name: 'site-unit', include: ['tests/substack.test.ts'], environment: 'node' },
});
