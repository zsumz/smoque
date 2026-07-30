import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import type { SmokeEvent } from '../../../../dist/events.js';
import { escapeRegExp } from '../../../../dist/shared/text-pattern.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.cmd captures output, execution metadata, and command events', async () => {
    const events: SmokeEvent[] = [];

    smoke.suite('command smoke', async (t) => {
        const result = await t.step('run node command', async () =>
            t.cmd(process.execPath, [
                '-e',
                'console.log(process.cwd()); console.error("warn");',
            ]));

        assert.equal(result.exitCode, 0);
        assert.equal(result.cwd, process.cwd());
        assert.match(result.stdout, new RegExp(escapeRegExp(process.cwd()), 'u'));
        assert.equal(result.stderr, 'warn\n');
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: {
            emit(event) {
                events.push(event);
            },
        },
    });

    assert.equal(result.status, 'passed');
    assert.deepEqual(
        events.map((event) => event.type),
        [
            'run.started',
            'suite.discovered',
            'suite.started',
            'step.started',
            'command.started',
            'command.output',
            'command.output',
            'command.finished',
            'step.passed',
            'suite.finished',
            'run.finished',
        ],
    );
    const commandStarted = events.find((event) => event.type === 'command.started');
    assert.equal(commandStarted?.stepId, 'suite-1:step-1');
});

test('t.cmd duration ignores wall-clock rollback', async () => {
    let wallClock = 1_000;
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => wallClock);

    smoke.suite('command duration', async (t) => {
        const pending = t.cmd(process.execPath, [
            '-e',
            'setTimeout(() => undefined, 10);',
        ]);
        wallClock = 0;

        const result = await pending;
        assert.equal(Number.isInteger(result.durationMs), true);
        assert.ok(result.durationMs >= 0);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        assert.equal(result.status, 'passed');
    } finally {
        dateNow.mockRestore();
    }
});
