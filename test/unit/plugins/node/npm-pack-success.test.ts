import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import nodePlugin from '../../../../dist/plugins/node.js';
import { writeBasicPackage } from './node-package-fixtures.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.npm.pack creates a tarball and returns package metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-pack-'));
    const packageRoot = join(root, 'package');
    const destination = join(root, 'packed');
    let tarballPath: string | undefined;

    try {
        await writeBasicPackage(packageRoot);
        await mkdir(destination, { recursive: true });

        smoke.use(nodePlugin());
        smoke.suite('pack fixture', async (t) => {
            const artifact = await t.npm.pack({ cwd: packageRoot, destination });

            assert.equal(artifact.filename, 'smoque-pack-fixture-1.2.3.tgz');
            assert.equal(artifact.packageName, 'smoque-pack-fixture');
            assert.equal(artifact.version, '1.2.3');
            assert.equal(
                artifact.path,
                join(destination, 'smoque-pack-fixture-1.2.3.tgz'),
            );
            tarballPath = artifact.path;
        });

        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.ok(tarballPath);
        await access(tarballPath);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
