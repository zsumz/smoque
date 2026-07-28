import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.cmd supports env overrides and stdin', async () => {
    smoke.suite('env and stdin', async (t) => {
        const result = await t.step('read stdin and env', async () =>
            t.cmd(
                process.execPath,
                ['-e', 'process.stdin.on("data", (data) => console.log(`${process.env.SMOKR_WORD}:${data}`));'],
                {
                    env: { SMOKR_WORD: 'hello' },
                    stdin: 'smoke',
                },
            ));

        assert.equal(result.stdout, 'hello:smoke\n');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});

test('t.sh intentionally runs through the platform shell', async () => {
    smoke.suite('shell command', async (t) => {
        const result = await t.step('run shell', async () => t.sh('printf shell-ok'));

        assert.equal(result.stdout, 'shell-ok');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});
