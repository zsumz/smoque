import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:net';

export async function listen(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}

export async function close(server: Server): Promise<void> {
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

export function serverPort(server: Server): number {
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    return address.port;
}

export async function reserveFreePort(): Promise<number> {
    const server = new (await import('node:net')).Server();
    await listen(server);
    const port = serverPort(server);
    await close(server);
    return port;
}

export async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks).toString('utf8');
}
