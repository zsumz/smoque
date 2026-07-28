import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { SmokeError } from '../../../../dist/errors.js';
import nodePlugin from '../../../../dist/plugins/node.js';
import { npmPack } from '../../../../dist/plugins/node/npm-pack.js';
import { writeLifecyclePackage } from './node-package-fixtures.js';
import { withPackCommandOutput } from './npm-pack-command-output.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.npm.pack reports lifecycle failure output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-pack-failure-'));
    const packageRoot = join(root, 'package');
    const destination = join(root, 'packed');

    try {
        await writeLifecyclePackage(
            packageRoot,
            'pack-script-fails',
            [
                'console.log("prepack stdout marker");',
                'console.error("prepack stderr marker");',
                'process.exit(7);',
            ].join('\n'),
        );

        smoke.use(nodePlugin());
        smoke.suite('pack lifecycle failure', async (t) => {
            await assert.rejects(
                async () => t.npm.pack({ cwd: packageRoot, destination }),
                (error: unknown) => {
                    assert.ok(error instanceof SmokeError);
                    assert.match(error.message, /npm pack failed with exit code/u);
                    assert.ok(error.details);
                    assert.equal(error.details.cwd, packageRoot);
                    assert.equal(error.details.scripts, 'allow');
                    const output = `${String(error.details.stdout)}\n${String(error.details.stderr)}`;
                    assert.match(output, /prepack stdout marker/u);
                    assert.match(output, /prepack stderr marker/u);
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

test('t.npm.pack parses lifecycle output and reports malformed results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-node-pack-output-'));
    const tarball = 'pack-output-fixture-1.2.3.tgz';

    try {
        await writeFile(join(root, tarball), 'packed', 'utf8');
        smoke.suite('pack output parsing', async (t) => {
            const artifact = await npmPack(withPackCommandOutput(t, [
                '> pack-output-fixture@1.2.3 prepack',
                '> node prepack.cjs',
                JSON.stringify([{
                    filename: tarball,
                    name: 'pack-output-fixture',
                    version: '1.2.3',
                }]),
            ].join('\n')));

            assert.equal(artifact.filename, tarball);
            assert.equal(artifact.packageName, 'pack-output-fixture');
            assert.equal(artifact.version, '1.2.3');

            await assert.rejects(
                async () => npmPack(withPackCommandOutput(t, 'not-json', 'npm stderr')),
                (error: unknown) => {
                    assert.ok(error instanceof SmokeError);
                    assert.match(error.message, /did not return parseable JSON/u);
                    assert.ok(error.details);
                    assert.equal(error.details.stdout, 'not-json');
                    assert.equal(error.details.stderr, 'npm stderr');
                    return true;
                },
            );
            await assert.rejects(
                async () => npmPack(withPackCommandOutput(
                    t,
                    JSON.stringify([{ name: 'missing-filename' }]),
                )),
                /did not include a tarball filename/u,
            );
            await assert.rejects(
                async () => npmPack(withPackCommandOutput(
                    t,
                    JSON.stringify([{ filename: 'missing.tgz' }]),
                )),
                /no tarball was found/u,
            );
        });

        const result = await runRegisteredSuites({ repoRoot: root });
        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
