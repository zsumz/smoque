import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect } from '../../../dist/core.js';

test('expect.file checks existence and content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-file-'));
    const file = join(root, 'dist', 'index.js');

    try {
        await mkdir(join(root, 'dist'), { recursive: true });
        await writeFile(file, 'export const ok = true;\n', 'utf8');

        await expect.file(file).toExist();
        await expect.file(join(root, 'missing.txt')).notToExist();
        await expect.file(file).toContain('export const ok');
        await expect.file(file).toContain(/ok\s*=\s*true/u);
        await expect.file(file).notToContain('process.env');

        await assert.rejects(
            async () => expect.file(join(root, 'missing.txt')).toExist(),
            /Expected file to exist/u,
        );
        await assert.rejects(
            async () => expect.file(file).notToExist(),
            /Expected file not to exist/u,
        );
        await assert.rejects(
            async () => expect.file(file).toContain('missing export'),
            /Expected file to contain/u,
        );
        await assert.rejects(
            async () => expect.file(file).notToContain('export const'),
            /Expected file not to contain/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
