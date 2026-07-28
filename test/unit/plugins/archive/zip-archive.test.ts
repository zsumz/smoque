import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import archivePlugin from '../../../../dist/plugins/archive.js';
import { createZip } from './archive-fixtures.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.archive.list lists zip and jar entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-archive-zip-'));

    try {
        const zipPath = join(root, 'fixture.zip');
        const jarPath = join(root, 'fixture.jar');
        const zip = createZip([
            ['dist/index.js', 'export const ok = true;\n'],
            ['META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\n'],
        ]);

        await writeFile(zipPath, zip);
        await writeFile(jarPath, zip);

        smoke.use(archivePlugin());
        smoke.suite('zip listing', async (t) => {
            assert.deepEqual(await t.archive.list(zipPath), [
                'META-INF/MANIFEST.MF',
                'dist/index.js',
            ]);
            assert.deepEqual(await t.archive.list(jarPath), [
                'META-INF/MANIFEST.MF',
                'dist/index.js',
            ]);
        });

        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
