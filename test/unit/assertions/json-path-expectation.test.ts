import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect } from '../../../dist/core.js';
import type { CommandResult } from '../../../dist/types/command.js';
import { assertDetailedExpectationError } from './detailed-expectation-error.js';

test('expect.command and expect.file assert structured JSON paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-json-'));
    const config = join(root, 'config.json');
    const command: CommandResult = {
        command: 'demo-cli',
        args: ['config'],
        cwd: root,
        exitCode: 0,
        stdout: JSON.stringify({ ok: true, nested: { name: 'demo', tags: ['cli', 'json'] } }),
        stderr: JSON.stringify({ warning: { code: 'soft' } }),
        durationMs: 1,
    };

    try {
        await writeFile(
            config,
            JSON.stringify({ service: { port: 4173, enabled: true } }),
            'utf8',
        );

        await expect.command(command).stdoutJsonPath('$.ok').toBe(true);
        await expect.command(command).stdoutJsonPath('$.nested').toEqual({
            name: 'demo',
            tags: ['cli', 'json'],
        });
        await expect.command(command).stdoutJsonPath('$.nested').toEqual({
            tags: ['cli', 'json'],
            name: 'demo',
        });
        await expect.command(command).stderrJsonPath('$.warning.code').toBe('soft');
        await expect.file(config).jsonPath('$.service.port').toBe(4173);
        await expect.file(config).jsonPath('$.service.enabled').toExist();

        await assert.rejects(
            async () => {
                await expect.command({ ...command, stdout: 'not json' })
                    .stdoutJsonPath('$.ok')
                    .toExist();
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected valid JSON/u);
                assert.equal(error.details.source, 'command');
                assert.equal(error.details.output, 'stdout');
                assert.equal(error.details.command, 'demo-cli');
                assert.equal(error.details.excerpt, 'not json');
                return true;
            },
        );

        await assert.rejects(
            async () => {
                await expect.file(config).jsonPath('$.service.missing').toExist();
            },
            (error: unknown) => {
                assertDetailedExpectationError(error);
                assert.match(error.message, /Expected JSON path \$\.service\.missing to exist/u);
                assert.equal(error.details.source, 'file');
                assert.equal(error.details.path, config);
                assert.equal(error.details.jsonPath, '$.service.missing');
                return true;
            },
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
