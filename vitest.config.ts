import { defineConfig } from 'vitest/config';

// Packages join this list as they gain tests. Order follows PLAN.md section 12.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'root-scripts',
          include: ['scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
      'packages/dataset',
      'packages/core',
    ],
  },
});
