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

test('t.process.group starts named processes and stops them in reverse order', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-process-group-'));
    const stopFile = join(root, 'stops.txt');
    let appPid: number | undefined;
    let workerPid: number | undefined;

    smoke.suite('process group', async (t) => {
        const group = t.process.group('demo-stack');
        const app = await group.start(
            'app',
            process.execPath,
            [
                '-e',
                `
                const fs = require("node:fs");
                process.on("SIGTERM", () => {
                    fs.appendFileSync(${JSON.stringify(stopFile)}, "app\\n");
                    process.exit(0);
                });
                console.log("app ready");
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.log.contains('app ready', { stream: 'stdout' }),
                timeout: '2s',
            },
        );
        const worker = await group.start(
            'worker',
            process.execPath,
            [
                '-e',
                `
                const fs = require("node:fs");
                process.on("SIGTERM", () => {
                    fs.appendFileSync(${JSON.stringify(stopFile)}, "worker\\n");
                    process.exit(0);
                });
                console.log("worker ready");
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.log.contains('worker ready', { stream: 'stdout' }),
                timeout: '2s',
            },
        );

        appPid = app.pid;
        workerPid = worker.pid;
        assert.equal(group.get('app'), app);
        assert.equal(group.get('worker'), worker);

        await group.stop();
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.equal(isProcessAlive(appPid), false);
        assert.equal(isProcessAlive(workerPid), false);
        assert.deepEqual((await readFile(stopFile, 'utf8')).trim().split('\n'), ['worker', 'app']);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
