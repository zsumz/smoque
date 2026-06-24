import { Socket } from 'node:net';

import { parseDuration } from './duration.js';
import type { Probe, TcpApi, TcpReadyOptions } from './types.js';

export function createTcpApi(): TcpApi {
    return {
        ready(input: TcpReadyOptions | number, options: Omit<TcpReadyOptions, 'port'> = {}): Probe {
            const readyOptions = normalizeReadyOptions(input, options);
            const host = readyOptions.host ?? '127.0.0.1';
            const timeoutMs = parseDuration(readyOptions.timeout, 1_000);

            return {
                description: `TCP ${host}:${String(readyOptions.port)}`,
                async check() {
                    try {
                        await connect(host, readyOptions.port, timeoutMs);
                        return { ready: true, message: 'connected' };
                    } catch (error) {
                        return {
                            ready: false,
                            message: error instanceof Error ? error.message : String(error),
                        };
                    }
                },
            };
        },
    };
}

function normalizeReadyOptions(
    input: TcpReadyOptions | number,
    options: Omit<TcpReadyOptions, 'port'>,
): TcpReadyOptions {
    if (typeof input === 'number') {
        return { ...options, port: input };
    }

    return input;
}

async function connect(host: string, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        let settled = false;

        const finish = (error?: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            socket.destroy();
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => {
            finish();
        });
        socket.once('timeout', () => {
            finish(new Error(`Timed out connecting to ${host}:${String(port)}`));
        });
        socket.once('error', finish);
        socket.connect(port, host);
    });
}
