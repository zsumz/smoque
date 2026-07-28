import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { isProcessAlive, waitForProcessExit } from './process-observation.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.process.start registers cleanup automatically', async () => {
    let pid: number | undefined;

    smoke.suite('auto cleanup process', async (t) => {
        const app = await t.process.start(
            process.execPath,
            ['-e', 'setInterval(() => undefined, 1000);'],
        );
        pid = app.pid;
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.equal(isProcessAlive(pid), false);
});

test(
    't.process.start stop terminates child processes',
    { skip: process.platform === 'win32' },
    async () => {
        const root = await mkdtemp(join(tmpdir(), 'smoque-process-tree-'));
        const childPidFile = join(root, 'child-pid.txt');
        let childPid: number | undefined;

        smoke.suite('process tree cleanup', async (t) => {
            const app = await t.process.start(
                process.execPath,
                [
                    '-e',
                    `
                    const { spawn } = require("node:child_process");
                    const fs = require("node:fs");
                    const child = spawn(
                        process.execPath,
                        ["-e", "setInterval(() => undefined, 1000);"],
                        { stdio: "ignore" },
                    );
                    fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid));
                    setInterval(() => undefined, 1000);
                    `,
                ],
                {
                    ready: t.fs.ready(childPidFile),
                    timeout: '2s',
                },
            );

            childPid = Number.parseInt(await t.fs.readText(childPidFile), 10);
            await app.stop();
        });

        try {
            const result = await runRegisteredSuites({ repoRoot: root });

            assert.equal(result.status, 'passed');
            assert.ok(childPid !== undefined);
            await waitForProcessExit(childPid);
            assert.equal(isProcessAlive(childPid), false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    },
);
