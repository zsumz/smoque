import { parseDuration } from './duration.js';
import { ProbeTimeoutError, SmokeError } from './errors.js';
import type { PollOptions } from './types.js';

export async function poll<T>(name: string, fn: () => Promise<T> | T, options: PollOptions = {}): Promise<T> {
    const timeoutMs = parseDuration(options.timeout, 30_000);
    const intervalMs = parseDuration(options.interval, 250);
    const startedAt = Date.now();
    let attempts = 0;
    let lastError: unknown;

    while (Date.now() - startedAt <= timeoutMs) {
        attempts += 1;

        try {
            const value = await fn();
            if (value === false) {
                throw new SmokeError('Poll condition returned false.');
            }

            return value;
        } catch (error) {
            lastError = error;
        }

        const elapsedMs = Date.now() - startedAt;
        const remainingMs = timeoutMs - elapsedMs;
        if (remainingMs <= 0) {
            break;
        }

        await sleep(Math.min(intervalMs, remainingMs));
    }

    throw new ProbeTimeoutError(`Timed out waiting for ${name} after ${String(timeoutMs)}ms.`, {
        name,
        timeoutMs,
        intervalMs,
        attempts,
        lastError: serializeLastError(lastError),
    });
}

function serializeLastError(error: unknown): Record<string, unknown> | undefined {
    if (!error) {
        return undefined;
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            ...'details' in error && error.details !== undefined ? { details: error.details } : {},
        };
    }

    return {
        name: 'Error',
        message: formatUnknownError(error),
    };
}

function formatUnknownError(error: unknown): string {
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'number' || typeof error === 'boolean' || error === null || error === undefined) {
        return String(error);
    }
    const serialized = JSON.stringify(error) as string | undefined;
    return serialized ?? Object.prototype.toString.call(error);
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
