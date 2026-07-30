import type { ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { parseDuration } from './duration.js';
import { ProbeTimeoutError, SmokeError } from './errors.js';
import { reservedPortErrorDetails } from './ports.js';
import type { ManagedProcessHandle } from './process-handle.js';
import { monotonicMilliseconds } from './timing.js';
import type { ProcessStartOptions } from './types/process.js';

export async function waitForProcessSpawn(
    child: ChildProcess,
    command: string,
    options: ProcessStartOptions,
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', (error) => {
            reject(new SmokeError(`Process failed to start: ${command}`, {
                ...reservedPortErrorDetails(options.env),
                cause: error.message,
            }));
        });
    });
}

export async function waitForProcessReady(
    options: ProcessStartOptions,
    handle: ManagedProcessHandle,
): Promise<void> {
    const timeoutMs = parseDuration(options.timeout, 30_000);
    const intervalMs = 100;
    const startedAt = monotonicMilliseconds();
    let attempts = 0;
    let lastMessage: string | undefined;

    while (monotonicMilliseconds() - startedAt <= timeoutMs) {
        attempts += 1;

        if (handle.exitDetails().exitCode !== null || handle.exitDetails().signal !== null) {
            throw new SmokeError('Process exited before it became ready.', {
                ready: options.ready?.description,
                ...reservedPortErrorDetails(options.env),
                ...handle.exitDetails(),
            });
        }

        const result = await options.ready?.check(handle);
        if (result?.ready) {
            return;
        }

        lastMessage = result?.message;
        const remainingMs = timeoutMs - (monotonicMilliseconds() - startedAt);
        if (remainingMs <= 0) {
            break;
        }
        await sleep(Math.min(intervalMs, remainingMs));
    }

    throw new ProbeTimeoutError(
        `Timed out waiting for process readiness after ${String(timeoutMs)}ms.`,
        {
            probe: options.ready?.description,
            timeoutMs,
            attempts,
            lastMessage,
            ...reservedPortErrorDetails(options.env),
            ...handle.exitDetails(),
        },
    );
}
