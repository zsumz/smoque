import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.cmd throws on non-zero exit by default', async () => {
    smoke.suite('failing command', async (t) => {
        await t.step('run bad command', async () =>
            t.cmd(process.execPath, ['-e', 'console.error("nope"); process.exit(7);']));
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });
    const [suite] = result.suites;
    const [step] = suite?.steps ?? [];
    const error = suite?.error;

    assert.equal(result.status, 'failed');
    assert.ok(error);
    assert.equal(error.name, 'CommandFailedError');
    assert.equal(error.details?.exitCode, 7);
    assert.equal(step?.error?.details?.stderr, 'nope\n');
});

test('t.cmd returns non-zero results when check is false', async () => {
    smoke.suite('expected command failure', async (t) => {
        const result = await t.step('run expected failure', async () =>
            t.cmd(
                process.execPath,
                ['-e', 'console.error("expected"); process.exit(4);'],
                { check: false },
            ));

        assert.equal(result.exitCode, 4);
        assert.equal(result.stderr, 'expected\n');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});

test('t.cmd fails when the command times out', async () => {
    smoke.suite('timeout command', async (t) => {
        await t.step('hang briefly', async () =>
            t.cmd(
                process.execPath,
                ['-e', 'setTimeout(() => undefined, 1000);'],
                { timeout: '50ms' },
            ));
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });
    const [suite] = result.suites;
    const error = suite?.error;

    assert.equal(result.status, 'failed');
    assert.ok(error);
    assert.equal(error.name, 'CommandFailedError');
    assert.equal(error.details?.timeout, '50ms');
    assert.match(error.message, /timed out/u);
});
