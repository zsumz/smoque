import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect } from '../../../dist/core.js';
import { assertDetailedExpectationError } from './detailed-expectation-error.js';

test('expect.files matches globs and finds expected content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-files-'));

    try {
        await mkdir(join(root, 'dist', 'nested'), { recursive: true });
        await writeFile(join(root, 'dist', 'index.js'), 'export const ok = true;\n', 'utf8');
        await writeFile(join(root, 'dist', 'nested', 'other.js'), 'console.log("other");\n', 'utf8');
        await writeFile(join(root, 'dist', 'style.css'), 'body {}\n', 'utf8');

        await expect.files(join(root, 'dist')).matching('**/*.js').toContainAny(['other']);

        await assert.rejects(
            async () =>
                expect.files(join(root, 'dist')).matching('**/*.css').toContainAny(['other']),
            /Expected at least one matched file/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('expect.files.not.toContainAny reports the first offending file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-files-not-'));

    try {
        await mkdir(join(root, 'dist'), { recursive: true });
        await writeFile(join(root, 'dist', 'index.js'), 'import fs from "node:fs";\n', 'utf8');

        await assert.rejects(
            async () => {
                await expect.files(join(root, 'dist'))
                    .matching('**/*.js')
                    .not.toContainAny([/from\s+["']node:/u]);
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected files not to contain/u);
                assert.match(String(error.details.file), /index\.js$/u);
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
