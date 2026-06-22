import { defineConfig } from 'vitest/config';

const enforceCoverageThresholds = process.env.SMOQUE_COVERAGE_CHECK === '1';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['dist/**/*.js'],
      exclude: [
        'dist/cli/**',
        'dist/events.js',
        'dist/types.js',
        'dist/**/types.js',
        'dist/types/**',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: enforceCoverageThresholds
        ? {
            statements: 90,
            branches: 78,
            functions: 93,
            lines: 90,
          }
        : undefined,
    },
  },
});
