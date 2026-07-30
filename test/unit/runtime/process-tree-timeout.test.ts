import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { scheduleProcessTreeTimeout } from '../../../dist/process-tree.js';
import { createObservedChild } from './process-tree-observation.js';

afterEach(() => {
    vi.useRealTimers();
});

test('scheduleProcessTreeTimeout terminates and then force kills the process tree', () => {
    vi.useFakeTimers();
    const observed = createObservedChild();
    const timeout = scheduleProcessTreeTimeout(observed.child, 10, 5);

    vi.advanceTimersByTime(10);

    assert.equal(timeout.didExpire(), true);
    assert.deepEqual(observed.signals, ['SIGTERM']);

    vi.advanceTimersByTime(5);

    assert.deepEqual(observed.signals, ['SIGTERM', 'SIGKILL']);
    timeout.cancel();
});

test('scheduleProcessTreeTimeout can be cancelled before it expires', () => {
    vi.useFakeTimers();
    const observed = createObservedChild();
    const timeout = scheduleProcessTreeTimeout(observed.child, 10);

    timeout.cancel();
    vi.runAllTimers();

    assert.equal(timeout.didExpire(), false);
    assert.deepEqual(observed.signals, []);
});
