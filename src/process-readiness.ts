import type { ChildProcess } from 'node:child_process';

import { parseDuration } from './duration.js';
import { ProbeTimeoutError, SmokeError } from './errors.js';
import { reservedPortsFromEnv } from './ports.js';
import type { ManagedProcessHandle } from './process-handle.js';
import type { ProcessStartOptions } from './types.js';

export async function waitForProcessSpawn(
    child: ChildProcess,
    command: string,
    options: ProcessStartOptions,
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', (error) => {
            reject(new SmokeError(`Process failed to start: ${command}`, {
                ...reservedPortDetails(options),
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
    const startedAt = Date.now();
    let attempts = 0;
    let lastMessage: string | undefined;

    while (Date.now() - startedAt <= timeoutMs) {
        attempts += 1;

        if (handle.exitDetails().exitCode !== null || handle.exitDetails().signal !== null) {
            throw new SmokeError('Process exited before it became ready.', {
                ready: options.ready?.description,
                ...reservedPortDetails(options),
                ...handle.exitDetails(),
            });
        }

        const result = await options.ready?.check(handle);
        if (result?.ready) {
            return;
        }

        lastMessage = result?.message;
        const remainingMs = timeoutMs - (Date.now() - startedAt);
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
            ...reservedPortDetails(options),
            ...handle.exitDetails(),
        },
    );
}

function reservedPortDetails(
    options: ProcessStartOptions | undefined,
): { reservedPorts?: Record<string, unknown> } {
    const reservedPorts = reservedPortsFromEnv(options?.env);
    return reservedPorts === undefined ? {} : { reservedPorts };
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
