import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { SmokeError } from '../../../../dist/errors.js';
import nodePlugin from '../../../../dist/plugins/node.js';
import { writeLifecyclePackage } from './node-package-fixtures.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.npm.pack allows scripts by default and supports ignoring them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-pack-scripts-'));
    const destination = join(root, 'packed');
    const allowedRoot = join(root, 'allowed-package');
    const ignoredRoot = join(root, 'ignored-package');
    const legacyIgnoredRoot = join(root, 'legacy-ignored-package');

    try {
        await mkdir(destination, { recursive: true });
        await writeLifecyclePackage(allowedRoot, 'pack-scripts-allowed');
        await writeLifecyclePackage(ignoredRoot, 'pack-scripts-ignored');
        await writeLifecyclePackage(legacyIgnoredRoot, 'pack-scripts-legacy-ignored');

        smoke.use(nodePlugin());
        smoke.suite('pack script policy', async (t) => {
            await t.npm.pack({ cwd: allowedRoot, destination });
            await access(join(allowedRoot, 'prepack-ran.txt'));

            await t.npm.pack({ cwd: ignoredRoot, destination, scripts: 'ignore' });
            await assert.rejects(async () => access(join(ignoredRoot, 'prepack-ran.txt')), /ENOENT/u);

            await t.npm.pack({
                cwd: legacyIgnoredRoot,
                destination,
                ignoreScripts: true,
            });
            await assert.rejects(
                async () => access(join(legacyIgnoredRoot, 'prepack-ran.txt')),
                /ENOENT/u,
            );
        });

        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('t.npm.pack rejects unknown script policies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-pack-script-policy-'));

    try {
        smoke.use(nodePlugin());
        smoke.suite('pack script policy', async (t) => {
            await assert.rejects(
                async () => t.npm.pack({
                    // Exercise the runtime guard that protects JavaScript consumers.
                    scripts: 'sometimes' as never,
                }),
                (error: unknown) => {
                    assert.ok(error instanceof SmokeError);
                    assert.equal(error.name, 'SmokeError');
                    assert.match(error.message, /Unknown npm pack scripts policy: sometimes/u);
                    assert.deepEqual(error.details?.expected, ['allow', 'ignore']);
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
