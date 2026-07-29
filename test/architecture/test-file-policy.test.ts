import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    testFilePolicyFailure,
} from '../../scripts/architecture/module/test-file-policy.mts';

test('executable tests use the one supported extension', () => {
    for (const extension of ['js', 'mjs', 'cjs', 'mts']) {
        const relative = `test/unit/example.test.${extension}`;
        assert.equal(
            testFilePolicyFailure(relative),
            `${relative}: executable tests must use the *.test.ts extension.`,
        );
    }
    assert.equal(
        testFilePolicyFailure('test/unit/example.test.ts'),
        undefined,
    );
    assert.equal(
        testFilePolicyFailure('test/unit/example-fixture.mts'),
        undefined,
    );
});
