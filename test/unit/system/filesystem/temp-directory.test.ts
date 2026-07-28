import assert from 'node:assert/strict';
import { access, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.tempDir creates a path ref and cleans up after success', async () => {
    let tempPath: string | undefined;

    smoke.suite('temp dir', async (t) => {
        const temp = await t.tempDir('basic');
        tempPath = temp.toString();

        await t.fs.writeText(temp.path('nested', 'note.txt'), 'hello');

        assert.equal(await t.fs.exists(temp.path('nested', 'note.txt')), true);
        assert.equal(await t.fs.exists(temp.path('nested')), true);
        assert.equal(await t.fs.exists(temp.path('missing.txt')), false);
        assert.deepEqual(await t.fs.ready(temp.path('nested')).check(), {
            ready: true,
            message: temp.path('nested'),
        });
        assert.equal(await t.fs.readText(temp.path('nested', 'note.txt')), 'hello');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.ok(tempPath);
    await assert.rejects(access(tempPath), /ENOENT/u);
});

test('t.tempDir preserves files on failure when configured', async () => {
    let tempPath: string | undefined;

    smoke.suite('preserved temp dir', async (t) => {
        const temp = await t.tempDir('preserve');
        tempPath = temp.toString();

        await t.fs.writeText(temp.path('debug.log'), 'kept');

        await t.step('fail', () => {
            throw new Error('boom');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        keepWorkdirOnFail: true,
    });
    assert.ok(tempPath);

    try {
        assert.equal(result.status, 'failed');
        assert.equal(await readFile(join(tempPath, 'debug.log'), 'utf8'), 'kept');
    } finally {
        await rm(tempPath, { recursive: true, force: true });
    }
});
