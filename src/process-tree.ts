import type { ChildProcess } from 'node:child_process';

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
            if (!isNoSuchProcessError(error)) {
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

function isNoSuchProcessError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH';
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
