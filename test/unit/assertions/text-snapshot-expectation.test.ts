import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

test('text snapshots update and report diffs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-text-snapshot-'));
    const snapshotPath = join(root, '__snapshots__', 'cli-output.txt');

    try {
        smoke.suite('write text snapshot', async () => {
            await expect.text('alpha\nbeta\n').toMatchSnapshot(snapshotPath);
        });

        let result = await runRegisteredSuites({ repoRoot: root, updateSnapshots: true });
        assert.equal(result.status, 'passed');
        assert.equal(await readFile(snapshotPath, 'utf8'), 'alpha\nbeta\n');

        resetSmokeRegistry();
        smoke.suite('match text snapshot', async () => {
            await expect.text('alpha\nchanged\n').toMatchSnapshot(snapshotPath);
        });

        result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;
        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(error.message, /Text snapshot did not match/u);
        assert.match(String(error.details?.diff), /- 2: beta/u);
        assert.match(String(error.details?.diff), /\+ 2: changed/u);
    } finally {
        resetSmokeRegistry();
        await rm(root, { recursive: true, force: true });
    }
});
