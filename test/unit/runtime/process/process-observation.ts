import assert from 'node:assert/strict';
import type { Server } from 'node:net';
import { createServer } from 'node:net';

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

export async function reserveFreePort(): Promise<number> {
    const server = createServer();
    await listen(server);
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    await close(server);
    return address.port;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function listen(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}

async function close(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
