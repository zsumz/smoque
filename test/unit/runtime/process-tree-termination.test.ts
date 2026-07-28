import assert from 'node:assert/strict';
import { test } from 'vitest';

import { terminateProcessTree } from '../../../dist/process-tree.js';
import {
    createObservedChild,
    withPlatform,
    withProcessKill,
} from './process-tree-observation.js';

test('terminateProcessTree ignores children that already exited', () => {
    for (const child of [
        createObservedChild({ exitCode: 0 }),
        createObservedChild({ signalCode: 'SIGTERM' }),
    ]) {
        withProcessKill(() => {
            throw new Error('process.kill should not be called');
        }, () => {
            child.child.kill = () => {
                throw new Error('child.kill should not be called');
            };

            terminateProcessTree(child.child, 'SIGTERM');
        });
    }
});

test('terminateProcessTree signals the process group on non-Windows platforms', () => {
    const observed = createObservedChild({ pid: 4321 });
    const calls: Array<{ pid: number; signal: string | number | undefined }> = [];

    withPlatform('linux', () => {
        withProcessKill((pid, signal) => {
            calls.push({ pid, signal });
            return true;
        }, () => {
            terminateProcessTree(observed.child, 'SIGTERM');
        });
    });

    assert.deepEqual(calls, [{ pid: -4321, signal: 'SIGTERM' }]);
    assert.deepEqual(observed.signals, []);
});

test('terminateProcessTree falls back when the process group is gone', () => {
    const observed = createObservedChild({ pid: 4321 });
    const calls: Array<{ pid: number; signal: string | number | undefined }> = [];

    withPlatform('linux', () => {
        withProcessKill((pid, signal) => {
            calls.push({ pid, signal });
            throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
        }, () => {
            terminateProcessTree(observed.child, 'SIGTERM');
        });
    });

    assert.deepEqual(calls, [{ pid: -4321, signal: 'SIGTERM' }]);
    assert.deepEqual(observed.signals, ['SIGTERM']);
});

test('terminateProcessTree rethrows unexpected process group failures', () => {
    const observed = createObservedChild({ pid: 4321 });
    const expected = Object.assign(new Error('permission denied'), { code: 'EPERM' });

    withPlatform('linux', () => {
        withProcessKill(() => {
            throw expected;
        }, () => {
            assert.throws(() => {
                terminateProcessTree(observed.child, 'SIGTERM');
            }, expected);
        });
    });

    assert.deepEqual(observed.signals, []);
});

test('terminateProcessTree falls back when pid is unavailable', () => {
    const observed = createObservedChild({ pid: undefined });

    withPlatform('linux', () => {
        withProcessKill(() => {
            throw new Error('process.kill should not be called');
        }, () => {
            terminateProcessTree(observed.child, 'SIGTERM');
        });
    });

    assert.deepEqual(observed.signals, ['SIGTERM']);
});

test('terminateProcessTree uses child.kill on Windows', () => {
    const observed = createObservedChild({ pid: 4321 });

    withPlatform('win32', () => {
        withProcessKill(() => {
            throw new Error('process.kill should not be called');
        }, () => {
            terminateProcessTree(observed.child, 'SIGTERM');
        });
    });

    assert.deepEqual(observed.signals, ['SIGTERM']);
});
