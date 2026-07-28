import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { test } from 'vitest';

import { expect } from '../../../dist/core.js';
import { assertDetailedExpectationError } from './detailed-expectation-error.js';
import { createTar } from './tar-fixture.js';

test('expect.archive checks required and forbidden entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-archive-'));
    const archivePath = join(root, 'package.tgz');

    try {
        await writeFile(
            archivePath,
            gzipSync(
                createTar([
                    ['./package/index.js', 'export const ok = true;\n'],
                    ['./package/README.md', '# package\n'],
                ]),
            ),
        );

        await expect.archive(archivePath).toContainEntries([
            'package/index.js',
            'package/README.md',
        ]);
        await expect.archive(archivePath).not.toContainEntries([
            'package/.env',
            'package/private.key',
        ]);

        await assert.rejects(
            async () => {
                await expect.archive(archivePath).toContainEntries(['package/missing.js']);
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected archive to contain entries/u);
                assert.deepEqual(error.details.missing, ['package/missing.js']);
                assert.deepEqual(error.details.entries, ['package/README.md', 'package/index.js']);
                return true;
            },
        );

        await assert.rejects(
            async () => {
                await expect.archive(archivePath).not.toContainEntries(['package/index.js']);
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected archive not to contain entries/u);
                assert.deepEqual(error.details.forbidden, ['package/index.js']);
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
