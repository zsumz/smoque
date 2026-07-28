import assert from 'node:assert/strict';
import { test } from 'vitest';

import { forceKillProcessTreeAfter } from '../../../dist/process-tree.js';
import {
    createObservedChild,
    withPlatform,
    withProcessKill,
} from './process-tree-observation.js';

test('forceKillProcessTreeAfter sends SIGKILL after the delay', async () => {
    const observed = createObservedChild({ pid: 4321 });

    await withPlatform('win32', async () => {
        await withProcessKill(() => {
            throw new Error('process.kill should not be called');
        }, async () => {
            await forceKillProcessTreeAfter(observed.child, 1);
        });
    });

    assert.deepEqual(observed.signals, ['SIGKILL']);
});
