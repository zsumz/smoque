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
            ...(enforceCoverageThresholds
                ? {
                    thresholds: {
                        statements: 90.5,
                        branches: 79,
                        functions: 94,
                        lines: 90.5,
                    },
                }
                : {}),
        },
    },
});
