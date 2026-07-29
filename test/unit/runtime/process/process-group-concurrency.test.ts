import assert from 'node:assert/strict';
import { test } from 'vitest';

import { toPathRef } from '../../../../dist/path-ref.js';
import { createManagedProcessGroup } from '../../../../dist/process-group.js';
import type { ProcessHandle } from '../../../../dist/types/process.js';

test('concurrent starts reserve a process name once', async () => {
    const start = deferred<ProcessHandle>();
    let calls = 0;
    const group = createManagedProcessGroup(
        'workers',
        toPathRef(process.cwd()),
        async () => {
            calls += 1;
            return await start.promise;
        },
    );

    const first = group.start('api', 'serve');
    const duplicate = group.start('api', 'serve');

    await Promise.resolve();
    assert.equal(calls, 1);

    start.resolve(processHandle('api'));

    assert.equal(await first, group.get('api'));
    await assert.rejects(duplicate, /already has a process named: api/);
    assert.equal(calls, 1);
    await group.stop();
});

test('stop waits for an in-flight start before stopping its handle', async () => {
    const start = deferred<ProcessHandle>();
    const stopped: string[] = [];
    const group = createManagedProcessGroup(
        'workers',
        toPathRef(process.cwd()),
        async () => await start.promise,
    );

    const starting = group.start('api', 'serve');
    const stopping = group.stop();

    start.resolve(processHandle('api', stopped));

    await starting;
    await stopping;

    assert.deepEqual(stopped, ['api']);
    await assert.rejects(group.start('worker', 'serve'), /already stopped: workers/);
});

function processHandle(name: string, stopped: string[] = []): ProcessHandle {
    return {
        name,
        kind: 'process',
        pid: undefined,
        stdout: () => '',
        stderr: () => '',
        async stop() {
            stopped.push(name);
            await Promise.resolve();
        },
        async cleanup() {
            await this.stop();
        },
    };
}

function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
} {
    let resolvePromise: (value: T) => void = () => {
        throw new Error('Deferred promise was not initialized');
    };
    const promise: Promise<T> = new Promise((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}
