import assert from 'node:assert/strict';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { toPathRef } from '../../../../dist/path-ref.js';
import { createManagedProcessGroup } from '../../../../dist/process-group.js';
import type { ArtifactSink } from '../../../../dist/types/artifacts.js';
import type { ProcessHandle } from '../../../../dist/types/process.js';

test('process groups reject duplicate and post-stop starts', async () => {
    let starts = 0;
    const handle = createHandle('app', async () => {
        await Promise.resolve();
    });
    const group = createManagedProcessGroup(
        'stack',
        toPathRef(process.cwd()),
        async () => {
            starts += 1;
            await Promise.resolve();
            return handle;
        },
    );

    assert.equal(await group.start('app', 'node'), handle);
    assert.equal(group.get('app'), handle);
    await assert.rejects(
        async () => group.start('app', 'node'),
        /already has a process named: app/u,
    );

    await group.stop();
    await group.stop();
    await assert.rejects(
        async () => group.start('worker', 'node'),
        /already stopped: stack/u,
    );
    assert.equal(starts, 1);
});

test('process group cleanup stops every handle and aggregates failures', async () => {
    const stopped: string[] = [];
    const attached: string[] = [];
    const handles = [
        createHandle(
            'app',
            async () => {
                stopped.push('app');
                await Promise.reject(new Error('app stop failed'));
            },
            async () => {
                attached.push('app');
                await Promise.resolve();
            },
        ),
        createHandle(
            'worker',
            async () => {
                stopped.push('worker');
                await Promise.reject(new Error('worker stop failed'));
            },
            async () => {
                attached.push('worker');
                await Promise.resolve();
            },
        ),
    ];
    let nextHandle = 0;
    const group = createManagedProcessGroup(
        'stack',
        toPathRef(process.cwd()),
        async () => {
            const handle = handles[nextHandle];
            nextHandle += 1;
            if (handle === undefined) {
                await Promise.reject(new Error('unexpected process start'));
                throw new Error('unreachable process start');
            }
            await Promise.resolve();
            return handle;
        },
    );

    await group.start('app', 'node');
    await group.start('worker', 'node');
    if (group.attachOnFailure === undefined) {
        throw new Error('process group should attach failure evidence');
    }
    await group.attachOnFailure(emptyArtifactSink);
    const error = await group.stop().then(
        () => undefined,
        (reason: unknown) => reason,
    );

    assert.deepEqual(attached, ['app', 'worker']);
    assert.deepEqual(stopped, ['worker', 'app']);
    assert.ok(error instanceof SmokeError);
    assert.deepEqual(error.details?.errors, [
        'worker stop failed',
        'app stop failed',
    ]);
    await group.cleanup();
});

const emptyArtifactSink: ArtifactSink = {
    file: async () => {
        await Promise.resolve();
    },
    dir: async () => {
        await Promise.resolve();
    },
    text: async () => {
        await Promise.resolve();
    },
};

function createHandle(
    name: string,
    stop: () => Promise<void>,
    attachOnFailure?: (sink: ArtifactSink) => Promise<void>,
): ProcessHandle {
    return {
        name,
        kind: 'process',
        pid: undefined,
        stdout: () => '',
        stderr: () => '',
        stop,
        cleanup: stop,
        ...attachOnFailure === undefined ? {} : { attachOnFailure },
    };
}
