import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    facadeImportFailure,
    sourceFacades,
} from '../../scripts/architecture/module/facade-policy.mts';

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
