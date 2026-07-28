import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { isProcessAlive } from './process-observation.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.process.start stops the child when readiness times out', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-process-timeout-'));
    const pidFile = join(root, 'pid.txt');

    smoke.suite('timeout process', async (t) => {
        await t.process.start(
            process.execPath,
            [
                '-e',
                `
                const fs = require("node:fs");
                fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: {
                    description: 'never ready',
                    async check() {
                        await Promise.resolve();
                        return { ready: false, message: 'still booting' };
                    },
                },
                timeout: '1s',
            },
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const pid = Number.parseInt(await readFile(pidFile, 'utf8'), 10);
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.equal(error.name, 'ProbeTimeoutError');
        assert.equal(error.details?.lastMessage, 'still booting');
        assert.equal(isProcessAlive(pid), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
