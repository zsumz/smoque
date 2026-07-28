import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('preserves the primary failure when cleanup also fails', async () => {
    smoke.suite('failure path', async (t) => {
        t.cleanup(() => {
            throw new Error('cleanup failed');
        });

        await t.step('primary failure', () => {
            throw new Error('step failed');
        });
    });

    const result = await runRegisteredSuites({ repoRoot: '/tmp/smoque-fixture' });
    const suite = result.suites[0];

    assert.equal(result.status, 'failed');
    assert.equal(suite?.status, 'failed');
    assert.equal(suite.error?.message, 'step failed');
    assert.equal(suite.cleanupErrors[0]?.message, 'cleanup failed');
});

test('continueOnFailure records the step failure and keeps executing', async () => {
    smoke.suite('soft failure', async (t) => {
        await t.step(
            'allowed failure',
            { continueOnFailure: true },
            () => {
                throw new Error('soft failure');
            },
        );

        await t.step('after soft failure', () => undefined);
    });

    const result = await runRegisteredSuites({ repoRoot: '/tmp/smoque-fixture' });
    const suite = result.suites[0];

    assert.equal(result.status, 'failed');
    assert.equal(suite?.error?.message, 'soft failure');
    assert.deepEqual(
        suite.steps.map((step) => step.status),
        ['failed', 'passed'],
    );
});
