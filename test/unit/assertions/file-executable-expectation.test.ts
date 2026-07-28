import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect } from '../../../dist/core.js';
import { assertDetailedExpectationError } from './detailed-expectation-error.js';

test('expect.file checks executables and checksums', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-executable-'));
    const script = join(root, 'demo-cli.js');
    const source = '#!/usr/bin/env node\nconsole.log("demo-cli 1.2.3");\n';
    const checksum = createHash('sha256').update(source).digest('hex');

    try {
        await writeFile(script, source, 'utf8');
        await chmod(script, 0o755);

        await expect.file(script).toBeExecutable({ args: ['--version'] });
        await expect.file(script).toHaveChecksum('sha256', checksum);

        await assert.rejects(
            async () => {
                await expect.file(script).toHaveChecksum('sha256', '0'.repeat(64));
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected sha256 checksum to match/u);
                assert.equal(error.details.algorithm, 'sha256');
                assert.equal(error.details.expected, '0'.repeat(64));
                assert.equal(error.details.actual, checksum);
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('expect.file reports non-executable permissions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-not-executable-'));
    const script = join(root, 'demo-cli.js');

    try {
        await writeFile(script, '#!/usr/bin/env node\n', 'utf8');
        await chmod(script, 0o644);

        await assert.rejects(
            async () => {
                await expect.file(script).toBeExecutable({ args: ['--version'] });
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected file to be executable/u);
                assert.equal(error.details.permissions, '0644');
                assert.equal(error.details.platform, process.platform);
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
