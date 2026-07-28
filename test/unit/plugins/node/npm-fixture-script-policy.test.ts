import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import nodePlugin from '../../../../dist/plugins/node.js';
import { createScriptPackageJson } from './node-package-fixtures.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('npm fixture ignores scripts by default and allows explicit opt in', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-install-policy-'));
    const packageRoot = join(root, 'package');
    const destination = join(root, 'packed');

    try {
        await mkdir(packageRoot, { recursive: true });
        await mkdir(destination, { recursive: true });
        await writeFile(
            join(packageRoot, 'package.json'),
            JSON.stringify(createScriptPackageJson(), null, 2),
            'utf8',
        );
        await writeFile(join(packageRoot, 'index.js'), 'export const ok = true;\n', 'utf8');
        await writeFile(
            join(packageRoot, 'postinstall.cjs'),
            'require("node:fs").writeFileSync("postinstall-ran.txt", "yes");\n',
            'utf8',
        );

        smoke.use(nodePlugin());
        smoke.suite('install script policy', async (t) => {
            const artifact = await t.npm.pack({ cwd: packageRoot, destination });
            const ignored = await t.npm.fixture({ dir: join(root, 'ignored-fixture') });

            await ignored.install(artifact.path, {
                audit: false,
                fund: false,
                packageLock: false,
            });
            await assert.rejects(
                async () => access(
                    ignored.path('node_modules', 'script-fixture', 'postinstall-ran.txt'),
                ),
                /ENOENT/u,
            );

            const allowed = await t.npm.fixture({ dir: join(root, 'allowed-fixture') });
            await allowed.install(artifact.path, {
                scripts: 'allow',
                audit: false,
                fund: false,
                packageLock: false,
            });
            await access(
                allowed.path('node_modules', 'script-fixture', 'postinstall-ran.txt'),
            );
        });

        const result = await runRegisteredSuites({ repoRoot: root });
        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
