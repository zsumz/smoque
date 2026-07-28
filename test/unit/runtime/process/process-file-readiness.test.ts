import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { isProcessAlive, reserveFreePort } from './process-observation.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.process.start waits for file readiness and stop is idempotent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-process-ready-'));
    const readyFile = join(root, 'ready.txt');
    let pid: number | undefined;

    smoke.suite('ready process', async (t) => {
        const app = await t.process.start(
            process.execPath,
            [
                '-e',
                `
                const fs = require("node:fs");
                setTimeout(() => fs.writeFileSync(${JSON.stringify(readyFile)}, "ready"), 20);
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.fs.ready(readyFile),
                timeout: '2s',
            },
        );

        pid = app.pid;
        assert.equal(await t.fs.readText(readyFile), 'ready');
        await app.stop();
        await app.stop();
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.equal(isProcessAlive(pid), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('t.process.start waits for TCP readiness', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-process-tcp-ready-'));
    const port = await reserveFreePort();
    let pid: number | undefined;

    smoke.suite('tcp ready process', async (t) => {
        const app = await t.process.start(
            process.execPath,
            [
                '-e',
                `
                const net = require("node:net");
                const server = net.createServer((socket) => socket.end("ok"));
                setTimeout(() => server.listen(${String(port)}, "127.0.0.1"), 20);
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.tcp.ready({ port, timeout: '250ms' }),
                timeout: '2s',
            },
        );

        pid = app.pid;
        assert.deepEqual(await t.tcp.ready(port).check(), { ready: true, message: 'connected' });
        await app.stop();
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.equal(isProcessAlive(pid), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
