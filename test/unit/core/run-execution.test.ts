import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { getRegisteredSuites, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';
import type { SmokeEvent } from '../../../dist/events.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('runs registered suites, preserves step values, emits events, and cleans up in reverse', async () => {
    const events: SmokeEvent[] = [];
    const cleanupOrder: string[] = [];

    smoke.suite('happy path', async (t) => {
        assert.equal(t.repoRoot().toString(), '/tmp/smoque-fixture');

        const value = await t.step('return value', () => 42);
        assert.equal(value, 42);

        t.cleanup(() => {
            cleanupOrder.push('first');
        });
        t.cleanup(() => {
            cleanupOrder.push('second');
        });
    });

    const result = await runRegisteredSuites({
        runId: 'test-run',
        repoRoot: '/tmp/smoque-fixture',
        eventSink: {
            emit(event) {
                events.push(event);
            },
        },
    });
    const [suite] = result.suites;
    const [step] = suite?.steps ?? [];

    assert.equal(result.status, 'passed');
    assert.equal(result.runId, 'test-run');
    assert.equal(suite?.status, 'passed');
    assert.equal(step?.status, 'passed');
    assert.deepEqual(cleanupOrder, ['second', 'first']);
    assert.deepEqual(
        events.map((event) => event.type),
        [
            'run.started',
            'suite.discovered',
            'suite.started',
            'step.started',
            'step.passed',
            'suite.finished',
            'run.finished',
        ],
    );
});

test('runs only selected suite ids', async () => {
    const events: SmokeEvent[] = [];
    const executed: string[] = [];

    smoke.suite('first suite', () => {
        executed.push('first');
    });
    smoke.suite('second suite', () => {
        executed.push('second');
    });

    const secondSuite = getRegisteredSuites().find((suite) => suite.name === 'second suite');
    assert.ok(secondSuite);
    const result = await runRegisteredSuites({
        repoRoot: '/tmp/smoque-fixture',
        suiteIds: [secondSuite.id],
        eventSink: {
            emit(event) {
                events.push(event);
            },
        },
    });

    assert.equal(result.status, 'passed');
    assert.deepEqual(executed, ['second']);
    assert.deepEqual(
        result.suites.map((suite) => suite.suite.name),
        ['second suite'],
    );
    assert.deepEqual(
        events.filter((event) => event.type === 'suite.discovered').map((event) => event.name),
        ['second suite'],
    );
});

test('emits user log messages with suite and step context', async () => {
    const events: SmokeEvent[] = [];

    smoke.suite('logging suite', async (t) => {
        t.redact('secret');
        await t.log('suite secret');
        await t.step('logged step', async () => {
            await t.log('step secret');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: '/tmp/smoque-fixture',
        eventSink: {
            emit(event) {
                events.push(event);
            },
        },
    });
    const logs = events.filter((event) => event.type === 'log.message');

    assert.equal(result.status, 'passed');
    assert.deepEqual(
        logs.map((event) => ({ suiteId: event.suiteId, stepId: event.stepId, message: event.message })),
        [
            { suiteId: 'suite-1', stepId: undefined, message: 'suite [redacted]' },
            { suiteId: 'suite-1', stepId: 'suite-1:step-1', message: 'step [redacted]' },
        ],
    );
});
