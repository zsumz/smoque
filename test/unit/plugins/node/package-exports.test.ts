import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    getExportEntry,
    getTypesPath,
    listExportedSubpaths,
    normalizeSubpaths,
} from '../../../../dist/plugins/node/exports.js';

test('package export helpers normalize subpaths and list export shapes', () => {
    assert.deepEqual(normalizeSubpaths(['.', ' plugin ', './already', '']), [
        '.',
        './plugin',
        './already',
        '.',
    ]);
    assert.equal(getExportEntry({ exports: './dist/index.js' }, '.'), './dist/index.js');
    assert.deepEqual(listExportedSubpaths({ exports: './dist/index.js' }), ['.']);

    const conditionalRoot = {
        exports: {
            types: './dist/index.d.ts',
            import: './dist/index.js',
            require: './dist/index.cjs',
        },
    };
    assert.deepEqual(getExportEntry(conditionalRoot, '.'), conditionalRoot.exports);
    assert.deepEqual(listExportedSubpaths(conditionalRoot), ['.']);

    const subpaths = {
        exports: {
            './plugin': './dist/plugin.js',
            '.': './dist/index.js',
            './cli': './dist/cli.js',
        },
    };
    assert.deepEqual(listExportedSubpaths(subpaths), ['.', './cli', './plugin']);
    assert.equal(getExportEntry(subpaths, './missing'), undefined);
    assert.deepEqual(listExportedSubpaths({ exports: 42 }), []);
});

test('package export helpers find type declarations in nested conditions', () => {
    assert.equal(getTypesPath({ exports: './dist/index.d.ts' }, '.'), './dist/index.d.ts');
    assert.equal(
        getTypesPath({ exports: './dist/index.js', types: './dist/index.d.ts' }, '.'),
        './dist/index.d.ts',
    );
    assert.equal(
        getTypesPath({ exports: './dist/index.js', typings: './dist/index.d.ts' }, '.'),
        './dist/index.d.ts',
    );

    const packageJson = {
        exports: {
            '.': [
                './dist/index.js',
                {
                    import: {
                        types: './dist/index.d.mts',
                        default: './dist/index.mjs',
                    },
                },
            ],
            './plugin': {
                node: {
                    typings: './dist/plugin.d.cts',
                    default: './dist/plugin.cjs',
                },
            },
            './missing': {
                import: './dist/missing.js',
            },
        },
    };

    assert.equal(getTypesPath(packageJson, '.'), './dist/index.d.mts');
    assert.equal(getTypesPath(packageJson, './plugin'), './dist/plugin.d.cts');
    assert.equal(getTypesPath(packageJson, './missing'), undefined);
});
