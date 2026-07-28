import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import archivePlugin from '../../../../dist/plugins/archive.js';
import { createTar } from './archive-fixtures.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.archive.list lists tar and tgz entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-archive-tar-'));

    try {
        const tarPath = join(root, 'fixture.tar');
        const tgzPath = join(root, 'fixture.tgz');
        const tar = createTar([
            ['package/index.js', 'export const ok = true;\n'],
            ['package/lib/util.js', 'export const util = true;\n'],
        ]);

        await writeFile(tarPath, tar);
        await writeFile(tgzPath, gzipSync(tar));

        smoke.use(archivePlugin());
        smoke.suite('tar listing', async (t) => {
            assert.deepEqual(await t.archive.list(tarPath), [
                'package/index.js',
                'package/lib/util.js',
            ]);
            assert.deepEqual(await t.archive.list(tgzPath), [
                'package/index.js',
                'package/lib/util.js',
            ]);
        });

        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
