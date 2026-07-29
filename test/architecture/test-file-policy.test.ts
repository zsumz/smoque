import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'vitest';

import { collectAllFiles } from '../../scripts/architecture/module/module-files.mts';
import {
    testFilePolicyFailure,
} from '../../scripts/architecture/module/test-file-policy.mts';

test('executable tests use the one supported extension', () => {
    for (const extension of ['js', 'mjs', 'cjs', 'mts', 'tsx', 'cts', 'jsx']) {
        const relative = `test/unit/example.test.${extension}`;
        assert.equal(
            testFilePolicyFailure(relative),
            `${relative}: executable tests must use the *.test.ts extension.`,
        );
    }
    for (const relative of [
        'test/unit/example.spec.ts',
        'test/unit/example.spec.js',
    ]) {
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

test('the policy scan sees test-like files with arbitrary extensions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-test-file-policy-'));
    const nested = join(root, 'nested');
    await mkdir(nested);
    const names = [
        'example.spec.ts',
        'example.test.cts',
        'example.test.jsx',
        'example.test.ts',
        'example.test.tsx',
    ];

    try {
        await Promise.all(
            names.map(async (name) => {
                await writeFile(join(nested, name), '', 'utf8');
            }),
        );
        const collected = await collectAllFiles(root);

        assert.deepEqual(
            collected.map((file) => basename(file)).sort(),
            names,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
