import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import type { SmokeEvent } from '../../../../dist/events.js';

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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
