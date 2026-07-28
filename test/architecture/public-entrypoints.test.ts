import assert from 'node:assert/strict';
import { test } from 'vitest';
import { inspectPackageEntrypoints } from '../../scripts/architecture/contract/package-entrypoints.mts';

const packageJson = {
    name: 'smoque',
    bin: { smoque: 'dist/cli/main.js' },
    exports: {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './plugin': { types: './dist/plugin.d.ts', default: './dist/plugin.js' },
    },
    types: './dist/index.d.ts',
};
const typeConfig = {
    compilerOptions: {
        paths: {
            smoque: ['src/index.ts'],
            'smoque/plugin': ['src/plugin.ts'],
        },
    },
};

test('package and TypeScript entrypoints share one contract', () => {
    assert.deepEqual(inspectPackageEntrypoints(packageJson, typeConfig), []);
});

test('entrypoint drift is rejected', () => {
    const changedPackage = {
        ...packageJson,
        exports: {
            ...packageJson.exports,
            './internal': {
                types: './dist/internal.d.ts',
                default: './dist/internal.js',
            },
        },
    };

    assert.match(
        inspectPackageEntrypoints(changedPackage, typeConfig).join('\n'),
        /exports do not match/u,
    );
});
