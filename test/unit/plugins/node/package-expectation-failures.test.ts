import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { createNpmPackageExpectation } from '../../../../dist/plugins/node/package-expectation.js';
import { writeInstalledPackage } from './node-package-fixtures.js';

test('npm package expectations report missing exports, types, and bins', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-package-expectation-'));

    try {
        await writeInstalledPackage(root, 'surface-package', {
            name: 'surface-package',
            version: '1.0.0',
            exports: {
                '.': './dist/index.js',
                './extra': './dist/extra.js',
                './typed': {
                    types: './dist/typed.d.ts',
                    default: './dist/typed.js',
                },
            },
            bin: {
                'surface-package': './dist/cli.js',
            },
        });

        const pkg = createNpmPackageExpectation(root, 'surface-package');
        await expectSmokeError(
            async () => pkg.toExposeOnly(['.', './missing']),
            /exports to match exactly/u,
            (details) => {
                assert.deepEqual(details.missingExports, ['./missing']);
                assert.deepEqual(details.unexpectedExports, ['./extra', './typed']);
            },
        );
        await expectSmokeError(
            async () => pkg.toHaveTypes('.'),
            /declare types for subpaths/u,
            (details) => {
                assert.deepEqual(details.missingTypes, ['.']);
            },
        );
        await expectSmokeError(
            async () => pkg.toHaveTypes('./typed'),
            /type declaration to exist/u,
            (details) => {
                assert.equal(details.subpath, './typed');
                assert.equal(details.types, './dist/typed.d.ts');
            },
        );
        await expectSmokeError(
            async () => pkg.toHaveBin('surface-package'),
            /package bin target to exist/u,
            (details) => {
                assert.equal(details.binTarget, './dist/cli.js');
            },
        );

        await mkdir(join(root, 'node_modules', 'surface-package', 'dist'), { recursive: true });
        await writeFile(
            join(root, 'node_modules', 'surface-package', 'dist', 'cli.js'),
            '#!/usr/bin/env node\n',
            'utf8',
        );
        await expectSmokeError(
            async () => pkg.toHaveBin('surface-package'),
            /installed package bin to exist/u,
            (details) => {
                assert.match(String(details.path), /node_modules\/\.bin\/surface-package$/u);
            },
        );
        await expectSmokeError(
            async () => pkg.toHaveBin('missing-bin'),
            /declare bin: missing-bin/u,
            (details) => {
                assert.equal(details.binName, 'missing-bin');
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

async function expectSmokeError(
    action: () => Promise<unknown>,
    message: RegExp,
    inspect: (details: Record<string, unknown>) => void,
): Promise<void> {
    await assert.rejects(action, (error: unknown) => {
        assert.ok(error instanceof SmokeError);
        assert.match(error.message, message);
        assert.ok(error.details);
        inspect(error.details);
        return true;
    });
}
