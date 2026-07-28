import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { SmokeError } from '../../../../dist/errors.js';
import nodePlugin from '../../../../dist/plugins/node.js';
import { createSurfacePackageJson } from './node-package-fixtures.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('npm fixture verifies installed exports, bins, and types', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-package-surface-'));
    const packageRoot = join(root, 'package');
    const destination = join(root, 'packed');

    try {
        await mkdir(join(packageRoot, 'dist', 'cli'), { recursive: true });
        await mkdir(destination, { recursive: true });
        await writeFile(
            join(packageRoot, 'package.json'),
            JSON.stringify(createSurfacePackageJson(), null, 2),
            'utf8',
        );
        await writeFile(join(packageRoot, 'dist', 'index.js'), 'export const ok = true;\n', 'utf8');
        await writeFile(join(packageRoot, 'dist', 'index.d.ts'), 'export declare const ok: true;\n', 'utf8');
        await writeFile(join(packageRoot, 'dist', 'plugin.js'), 'export const plugin = true;\n', 'utf8');
        await writeFile(join(packageRoot, 'dist', 'plugin.d.ts'), 'export declare const plugin: true;\n', 'utf8');
        await writeFile(
            join(packageRoot, 'dist', 'cli', 'main.js'),
            '#!/usr/bin/env node\nconsole.log("ok");\n',
            'utf8',
        );

        smoke.use(nodePlugin());
        smoke.suite('fixture package surface', async (t) => {
            const artifact = await t.npm.pack({ cwd: packageRoot, destination });
            const fixture = await t.npm.fixture({ dir: join(root, 'fixture') });
            await fixture.install(artifact.path, {
                scripts: 'ignore',
                audit: false,
                fund: false,
                packageLock: false,
            });

            const pkg = fixture.package('surface-fixture');
            await pkg.toExpose(['.', './plugin']);
            await pkg.toExposeOnly(['.', './plugin']);
            await pkg.toHaveBin('surface-fixture');
            await pkg.toHaveTypes(['.', './plugin']);

            await assert.rejects(
                async () => pkg.toExpose('./missing'),
                (error: unknown) => {
                    assert.ok(error instanceof SmokeError);
                    assert.match(error.message, /Expected package surface-fixture to expose subpaths/u);
                    assert.deepEqual(error.details?.missingExports, ['./missing']);
                    return true;
                },
            );
        });

        const result = await runRegisteredSuites({ repoRoot: root });
        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
