import { setTimeout as sleep } from 'node:timers/promises';

export { reserveFreePort } from '../../support/server-lifecycle.js';

export function isProcessAlive(pid: number | undefined): boolean {
    if (pid === undefined) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export async function waitForProcessExit(pid: number): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 1000) {
        if (!isProcessAlive(pid)) {
            return;
        }
        await sleep(20);
    }
}
