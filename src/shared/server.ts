import type { Server } from 'node:net';

export async function listenOnEphemeralPort(
    server: Server,
    host = '127.0.0.1',
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = (): void => {
            server.off('error', onError);
            resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        try {
            server.listen(0, host);
        } catch (error) {
            server.off('error', onError);
            server.off('listening', onListening);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
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
