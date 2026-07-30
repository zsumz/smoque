import assert from 'node:assert/strict';
import {
    mkdir,
    mkdtemp,
    rm,
    symlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { discoverMarkdownFiles } from '../../../dist/cli/discovery/markdown-files.js';
import { discoverSmokeFiles } from '../../../dist/cli/discovery/smoke-files.js';

test('file discovery preserves hidden files, ignores artifacts, and returns sorted paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-discovery-tree-'));
    const repoRoot = join(root, 'repo');
    const hiddenDirectory = join(repoRoot, '.custom');
    const smokeDirectory = join(repoRoot, 'smoke');
    const ignoredDirectory = join(repoRoot, 'node_modules');
    await Promise.all([
        mkdir(hiddenDirectory, { recursive: true }),
        mkdir(smokeDirectory, { recursive: true }),
        mkdir(ignoredDirectory, { recursive: true }),
    ]);
    const hiddenSmoke = join(hiddenDirectory, 'hidden.smoke.ts');
    const visibleSmoke = join(smokeDirectory, 'visible.smoke.mts');
    const hiddenMarkdown = join(hiddenDirectory, 'hidden.md');
    await Promise.all([
        writeFile(hiddenSmoke, '', 'utf8'),
        writeFile(visibleSmoke, '', 'utf8'),
        writeFile(hiddenMarkdown, '', 'utf8'),
        writeFile(join(ignoredDirectory, 'ignored.smoke.ts'), '', 'utf8'),
    ]);
    if (process.platform !== 'win32') {
        const outsideSmoke = join(root, 'outside.smoke.ts');
        await writeFile(outsideSmoke, '', 'utf8');
        await symlink(outsideSmoke, join(smokeDirectory, 'linked.smoke.ts'));
    }

    try {
        assert.deepEqual(
            await discoverSmokeFiles(repoRoot),
            [hiddenSmoke, visibleSmoke].sort(),
        );
        assert.deepEqual(
            await discoverMarkdownFiles(repoRoot, '.custom/hidden.md'),
            [hiddenMarkdown],
        );
        await assert.rejects(
            async () => discoverSmokeFiles(join(root, 'missing')),
            hasErrorCode('ENOENT'),
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

function hasErrorCode(code: string): (error: unknown) => boolean {
    return (error) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === code;
}
