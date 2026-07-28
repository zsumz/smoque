import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { readInstalledPackage } from '../../../../dist/plugins/node/package-json.js';

test('readInstalledPackage reports missing and malformed package metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-package-metadata-'));

    try {
        await assert.rejects(
            async () => readInstalledPackage(join(root, 'missing'), 'missing-package'),
            (error: unknown) => {
                assert.ok(error instanceof SmokeError);
                assert.match(error.message, /Expected installed package to exist: missing-package/u);
                assert.ok(error.details);
                assert.equal(error.details.packageName, 'missing-package');
                assert.equal(error.details.path, join(root, 'missing', 'package.json'));
                return true;
            },
        );

        const invalidRoot = join(root, 'invalid');
        await mkdir(invalidRoot, { recursive: true });
        await writeFile(join(invalidRoot, 'package.json'), '{ nope', 'utf8');
        await assert.rejects(
            async () => readInstalledPackage(invalidRoot, 'invalid-package'),
            (error: unknown) => {
                assert.ok(error instanceof SmokeError);
                assert.match(error.message, /Installed package has invalid package\.json/u);
                assert.equal(error.details?.packageRoot, invalidRoot);
                return true;
            },
        );

        const nonObjectRoot = join(root, 'non-object');
        await mkdir(nonObjectRoot, { recursive: true });
        await writeFile(join(nonObjectRoot, 'package.json'), 'null', 'utf8');
        await assert.rejects(
            async () => readInstalledPackage(nonObjectRoot, 'non-object-package'),
            (error: unknown) => {
                assert.ok(error instanceof SmokeError);
                assert.match(error.message, /package\.json must be an object/u);
                assert.equal(error.details?.path, join(nonObjectRoot, 'package.json'));
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
