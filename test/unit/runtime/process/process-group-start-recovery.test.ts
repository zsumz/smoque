import assert from 'node:assert/strict';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { toPathRef } from '../../../../dist/path-ref.js';
import { createManagedProcessGroup } from '../../../../dist/process-group.js';
import type { ProcessHandle } from '../../../../dist/types/process.js';

test('process group startup preserves its failure when cleanup also fails', async () => {
    let starts = 0;
    const group = createManagedProcessGroup(
        'demo',
        toPathRef(process.cwd()),
        async () => {
            starts += 1;
            if (starts === 1) {
                await Promise.resolve();
                return cleanupFailureHandle;
            }
            await Promise.reject(new Error('startup failed'));
            throw new Error('unreachable process start');
        },
    );

    await group.start('app', 'node');
    const error = await group.start('worker', 'node').then(
        () => undefined,
        (reason: unknown) => reason,
    );

    assert.ok(error instanceof SmokeError);
    assert.equal(
        error.message,
        'Process group "demo" failed starting "worker": startup failed',
    );
    assert.deepEqual(error.details?.cleanupErrors, ['cleanup failed']);
});

const cleanupFailureHandle: ProcessHandle = {
    name: 'app',
    kind: 'process',
    pid: undefined,
    stdout: () => '',
    stderr: () => '',
    async stop() {
        await Promise.reject(new Error('cleanup failed'));
    },
    async cleanup() {
        await Promise.reject(new Error('cleanup failed'));
    },
};
