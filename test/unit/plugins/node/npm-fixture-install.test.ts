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

test('t.npm.fixture installs a packed tarball and runs inline Node', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-fixture-'));
    const packageRoot = join(root, 'package');
    const destination = join(root, 'packed');
    let fixturePath: string | undefined;

    try {
        await writeBasicPackage(packageRoot);
        await mkdir(destination, { recursive: true });

        smoke.use(nodePlugin());
        smoke.suite('fixture install', async (t) => {
            const artifact = await t.npm.pack({ cwd: packageRoot, destination });
            const fixture = await t.npm.fixture({
                dir: join(root, 'fixture'),
                packageJson: {
                    private: true,
                    type: 'module',
                    dependencies: {},
                },
            });

            fixturePath = fixture.path();
            await fixture.install(artifact.path, {
                scripts: 'ignore',
                audit: false,
                fund: false,
                packageLock: false,
            });
            await fixture.node.inline(`
                import { ok } from "smoque-pack-fixture";
                if (ok !== true) throw new Error("package import failed");
            `);
        });

        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.ok(fixturePath);
        const installedFixturePath = fixturePath;
        await access(join(
            installedFixturePath,
            'node_modules',
            'smoque-pack-fixture',
            'index.js',
        ));
        await assert.rejects(
            async () => access(join(installedFixturePath, 'package-lock.json')),
            /ENOENT/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
