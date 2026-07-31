import assert from 'node:assert/strict';
import {
    mkdir,
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { listFilesInTree } from '../../../dist/shared/file-tree.js';

test('file-tree traversal includes hidden files and hidden directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-file-tree-'));
    const hiddenDirectory = join(root, '.custom', '.nested');
    const excludedDirectory = join(root, '.git', '.hidden');
    const visibleFile = join(root, 'visible.txt');
    const hiddenFile = join(root, '.hidden.txt');
    const nestedHiddenFile = join(hiddenDirectory, 'nested.txt');

    try {
        await Promise.all([
            mkdir(hiddenDirectory, { recursive: true }),
            mkdir(excludedDirectory, { recursive: true }),
        ]);
        await Promise.all([
            writeFile(visibleFile, '', 'utf8'),
            writeFile(hiddenFile, '', 'utf8'),
            writeFile(nestedHiddenFile, '', 'utf8'),
            writeFile(join(excludedDirectory, 'ignored.txt'), '', 'utf8'),
        ]);

        assert.deepEqual(
            await listFilesInTree(root, {
                excludeDirectoryNames: new Set(['.git']),
            }),
            [hiddenFile, nestedHiddenFile, visibleFile].sort(),
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
