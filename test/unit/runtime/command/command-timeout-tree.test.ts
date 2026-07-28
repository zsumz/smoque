import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { isProcessAlive, waitForProcessExit } from '../process/process-observation.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test(
    't.cmd timeout terminates child processes',
    { skip: process.platform === 'win32' },
    async () => {
        const root = await mkdtemp(join(tmpdir(), 'smoque-command-tree-'));
        const childPidFile = join(root, 'child-pid.txt');

        smoke.suite('timeout command tree', async (t) => {
            await t.step('hang with child process', async () =>
                t.cmd(
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
                    { timeout: '500ms' },
                ));
        });

        try {
            const result = await runRegisteredSuites({ repoRoot: root });
            const childPid = Number.parseInt(await readFile(childPidFile, 'utf8'), 10);

            assert.equal(result.status, 'failed');
            assert.equal(result.suites[0]?.error?.name, 'CommandFailedError');
            await waitForProcessExit(childPid);
            assert.equal(isProcessAlive(childPid), false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    },
);
