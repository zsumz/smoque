import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    facadeImportFailure,
    sourceFacades,
    testFacadeImportFailure,
} from '../../scripts/architecture/module/facade-policy.mts';
import {
    resolveTestSourceModule,
} from '../../scripts/architecture/module/test-module-target.mts';

test('implementation modules import concrete owners behind facades', () => {
    assert.equal(
        facadeImportFailure('src/core/runner.ts', 'src/types.ts', 1, 1),
        'src/core/runner.ts:1:1 implementation modules must import '
        + 'the concrete owner behind src/types.ts.',
    );
    assert.equal(
        facadeImportFailure('src/core/runner.ts', 'src/types/context.ts', 1, 1),
        undefined,
    );
});

test('composition entrypoints may assemble facades', () => {
    assert.equal(
        facadeImportFailure('src/index.ts', 'src/types.ts', 1, 1),
        undefined,
    );
});

test('tests use public entrypoints or concrete owners', () => {
    assert.equal(
        testFacadeImportFailure('src/types.ts'),
        'tests must import the public entrypoint or concrete owner behind src/types.ts.',
    );
    assert.equal(
        testFacadeImportFailure('src/types/context.ts'),
        undefined,
    );
});

test('built test imports resolve to their source owners', () => {
    assert.equal(
        resolveTestSourceModule(
            '/workspace',
            '/workspace/test/core.test.ts',
            '../dist/types.js',
        ),
        '/workspace/src/types.ts',
    );
    assert.equal(
        resolveTestSourceModule(
            '/workspace',
            '/workspace/test/core.test.ts',
            '../dist/types/context.js',
        ),
        '/workspace/src/types/context.ts',
    );
});

test('facade ownership is explicit', () => {
    assert.deepEqual(
        [...sourceFacades].sort(),
        [
            'src/command.ts',
            'src/expectations.ts',
            'src/reporters.ts',
            'src/types.ts',
        ],
    );
});
