import { once } from 'node:events';
import type { Server } from 'node:net';

export async function listenOnEphemeralPort(
    server: Server,
    host = '127.0.0.1',
): Promise<void> {
    server.listen(0, host);
    await once(server, 'listening');
}

export async function closeServer(server: Server): Promise<void> {
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
