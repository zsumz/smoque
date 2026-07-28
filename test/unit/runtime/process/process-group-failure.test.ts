import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import type { SmokeEvent } from '../../../../dist/events.js';
import { isProcessAlive } from './process-observation.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.process.group cleans up and attaches logs when a later process fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-process-group-failure-'));
    const events: SmokeEvent[] = [];
    let appPid: number | undefined;

    smoke.suite('process group failure', async (t) => {
        const group = t.process.group('demo-stack');
        const app = await group.start(
            'app',
            process.execPath,
            [
                '-e',
                `
                console.log("app ready");
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.log.contains('app ready', { stream: 'stdout' }),
                timeout: '2s',
            },
        );
        appPid = app.pid;

        await group.start(
            'worker',
            process.execPath,
            ['-e', 'console.error("worker boot failed"); process.exit(13);'],
            {
                ready: t.log.contains('worker ready', { stream: 'stdout' }),
                timeout: '1s',
            },
        );
    });

    try {
        const result = await runRegisteredSuites({
            repoRoot: root,
            eventSink: {
                emit(event) {
                    events.push(event);
                },
            },
        });
        const error = result.suites[0]?.error;
        const appStdout = events.find(
            (event): event is Extract<SmokeEvent, { type: 'artifact.attached' }> =>
                event.type === 'artifact.attached'
                && event.name === 'demo-stack-app-stdout.log',
        );

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.ok(error.details);
        assert.match(error.message, /Process group "demo-stack" failed starting "worker"/u);
        assert.equal(error.details.processGroup, 'demo-stack');
        assert.equal(error.details.processName, 'worker');
        assert.match(String(error.details.stderr), /worker boot failed/u);
        assert.equal(isProcessAlive(appPid), false);
        assert.ok(appStdout);
        assert.match(await readFile(appStdout.path, 'utf8'), /app ready/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
