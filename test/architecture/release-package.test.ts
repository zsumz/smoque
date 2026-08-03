import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { readPackFilename } from '../../scripts/release/release-package.mts';

describe('release package output', () => {
    test('reads the one tarball returned by npm pack', () => {
        assert.equal(
            readPackFilename([{ filename: 'smoque-0.1.1.tgz' }]),
            'smoque-0.1.1.tgz',
        );
    });

    test('rejects missing, multiple, and malformed pack results', () => {
        assert.throws(() => readPackFilename([]), /exactly one package/u);
        assert.throws(
            () => readPackFilename([{ filename: 'one.tgz' }, { filename: 'two.tgz' }]),
            /exactly one package/u,
        );
        assert.throws(
            () => readPackFilename([{ filename: 42 }]),
            /did not return a package filename/u,
        );
    });
});
