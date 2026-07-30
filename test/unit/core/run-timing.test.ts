import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('run, suite, and step durations ignore wall-clock rollback', async () => {
    let wallClock = 1_000;
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => wallClock);

    smoke.suite('monotonic durations', async (t) => {
        await t.step('move the wall clock backwards', () => {
            wallClock = 0;
        });
    });

    try {
        const result = await runRegisteredSuites({
            repoRoot: '/tmp/smoque-fixture',
        });
        const [suite] = result.suites;
        const [step] = suite?.steps ?? [];

        assert.equal(result.runId, 'run-1000');
        assertDuration(result.durationMs);
        assertDuration(suite?.durationMs);
        assertDuration(step?.durationMs);
    } finally {
        dateNow.mockRestore();
    }
});

function assertDuration(value: number | undefined): void {
    assert.ok(value !== undefined);
    assert.equal(Number.isInteger(value), true);
    assert.ok(value >= 0);
}
