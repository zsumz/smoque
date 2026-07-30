import type { ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { hasErrorCode } from './shared/errors.js';

export interface ProcessTreeTimeout {
    cancel(): void;
    didExpire(): boolean;
}

export function shouldUseProcessGroup(): boolean {
    return process.platform !== 'win32';
}

export function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    if (shouldUseProcessGroup() && child.pid !== undefined) {
        try {
            process.kill(-child.pid, signal);
            return;
        } catch (error) {
            if (!hasErrorCode(error, 'ESRCH')) {
                throw error;
            }
        }
    }

    child.kill(signal);
}

export async function forceKillProcessTreeAfter(child: ChildProcess, ms: number): Promise<void> {
    await sleep(ms);
    terminateProcessTree(child, 'SIGKILL');
}

export function scheduleProcessTreeTimeout(
    child: ChildProcess,
    timeoutMs: number,
    forceKillAfterMs = 500,
): ProcessTreeTimeout {
    let expired = false;
    let forceKillTimeout: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
        expired = true;
        terminateProcessTree(child, 'SIGTERM');
        forceKillTimeout = setTimeout(() => {
            terminateProcessTree(child, 'SIGKILL');
        }, forceKillAfterMs);
    }, timeoutMs);

    return {
        cancel(): void {
            clearTimeout(timeout);
            if (forceKillTimeout !== undefined) {
                clearTimeout(forceKillTimeout);
            }
        },
        didExpire(): boolean {
            return expired;
        },
    };
}
