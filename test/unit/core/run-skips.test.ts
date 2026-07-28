import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';
import type { SmokeEvent } from '../../../dist/events.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('marks a suite skipped when t.skip is called', async () => {
    smoke.suite('skip me', (t) => {
        t.skip('not relevant here');
    });

    const result = await runRegisteredSuites({ repoRoot: '/tmp/smoque-fixture' });
    const [suite] = result.suites;

    assert.equal(result.status, 'passed');
    assert.equal(suite?.status, 'skipped');
    assert.equal(suite.steps.length, 0);
});

test('marks a step skipped when t.skip is called inside t.step', async () => {
    const events: SmokeEvent[] = [];

    smoke.suite('skip in step', async (t) => {
        await t.step('maybe skip', () => t.skip('nope'));
    });

    const result = await runRegisteredSuites({
        repoRoot: '/tmp/smoque-fixture',
        eventSink: {
            emit(event) {
                events.push(event);
            },
        },
    });
    const suite = result.suites[0];

    assert.equal(result.status, 'passed');
    assert.equal(suite?.status, 'skipped');
    assert.equal(suite.error, undefined);
    assert.deepEqual(
        suite.steps.map((step) => ({ name: step.name, status: step.status, skipReason: step.skipReason })),
        [{ name: 'maybe skip', status: 'skipped', skipReason: 'nope' }],
    );
    assert.deepEqual(
        events.map((event) => event.type),
        [
            'run.started',
            'suite.discovered',
            'suite.started',
            'step.started',
            'step.skipped',
            'suite.finished',
            'run.finished',
        ],
    );
});

test('skip inside continueOnFailure step still skips the suite', async () => {
    let afterSkipRan = false;

    smoke.suite('skip beats continue', async (t) => {
        await t.step(
            'skip anyway',
            { continueOnFailure: true },
            () => t.skip('not today'),
        );

        afterSkipRan = true;
    });

    const result = await runRegisteredSuites({ repoRoot: '/tmp/smoque-fixture' });
    const suite = result.suites[0];

    assert.equal(result.status, 'passed');
    assert.equal(suite?.status, 'skipped');
    assert.equal(afterSkipRan, false);
    assert.deepEqual(
        suite.steps.map((step) => ({ status: step.status, skipReason: step.skipReason })),
        [{ status: 'skipped', skipReason: 'not today' }],
    );
});
