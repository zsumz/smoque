import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import { isProcessAlive } from './process-observation.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.process.start waits for stdout log readiness', async () => {
    let pid: number | undefined;

    smoke.suite('stdout log ready process', async (t) => {
        const app = await t.process.start(
            process.execPath,
            [
                '-e',
                `
                setTimeout(() => console.log("service ready"), 20);
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.log.contains(/service ready/u, { stream: 'stdout' }),
                timeout: '2s',
            },
        );

        pid = app.pid;
        assert.match(app.stdout(), /service ready/u);
        await app.stop();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.equal(isProcessAlive(pid), false);
});

test('t.process.start waits for stderr log readiness', async () => {
    smoke.suite('stderr log ready process', async (t) => {
        const app = await t.process.start(
            process.execPath,
            [
                '-e',
                `
                setTimeout(() => console.error("listening on stderr"), 20);
                setInterval(() => undefined, 1000);
                `,
            ],
            {
                ready: t.log.contains('listening on stderr', { stream: 'stderr' }),
                timeout: '2s',
            },
        );

        assert.match(app.stderr(), /listening on stderr/u);
        await app.stop();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});
