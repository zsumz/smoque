import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect, forbidden } from '../../../dist/core.js';
import { assertDetailedExpectationError } from './detailed-expectation-error.js';

test('expect.files.not.toContainForbidden reports rule names and line numbers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-forbidden-'));

    try {
        await mkdir(join(root, 'dist'), { recursive: true });
        await writeFile(
            join(root, 'dist', 'index.js'),
            [
                'export const ok = true;',
                'const token = \'npm_123456789012345678901234567890123456\';',
                '',
            ].join('\n'),
            'utf8',
        );

        await assert.rejects(
            async () => {
                await expect.files(root)
                    .matching('**/*.js')
                    .not.toContainForbidden(forbidden.npmTokens());
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Forbidden content matched rule "npm token"/u);
                assert.match(error.message, /index\.js:2/u);
                assert.doesNotMatch(error.message, /npm_123456/u);
                assert.equal(error.details.rule, 'npm token');
                assert.equal(error.details.line, 2);
                assert.match(String(error.details.file), /index\.js$/u);
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('expect.files.not.toContainForbidden reports forbidden file paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-forbidden-path-'));

    try {
        await mkdir(join(root, 'fixture'), { recursive: true });
        await writeFile(join(root, 'fixture', '.env'), 'TOKEN=secret\n', 'utf8');

        await assert.rejects(
            async () => {
                await expect.files(root).not.toContainForbidden(forbidden.envFiles());
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Forbidden file matched rule "env file"/u);
                assert.match(error.message, /fixture\/\.env/u);
                assert.equal(error.details.rule, 'env file');
                assert.match(String(error.details.file), /\.env$/u);
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
