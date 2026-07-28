import { createServer } from 'node:net';

import { SmokeError } from './errors.js';
import {
    attachReservedPortDetails,
    isReservedPort,
    type ReservedPortDetails,
} from './ports/reserved-port-env.js';
import type { PortReserveOptions, PortsApi, ReservedPort } from './types.js';

export { reservedPortsFromEnv } from './ports/reserved-port-env.js';

export function createPortsApi(registerCleanup: (fn: () => Promise<void> | void) => void): PortsApi {
    const usedPorts: Set<number> = new Set();
    const reservations: Map<string, ReservedPortDetails> = new Map();
    let cleanupRegistered = false;

    function ensureCleanup(): void {
        if (cleanupRegistered) {
            return;
        }

        cleanupRegistered = true;
        registerCleanup(() => {
            usedPorts.clear();
            reservations.clear();
        });
    }

    return {
        async reserve(name = `port-${String(reservations.size + 1)}`, options: PortReserveOptions = {}): Promise<ReservedPort> {
            ensureCleanup();
            if (reservations.has(name)) {
                throw new SmokeError(`Reserved port name already exists: ${name}`, { name });
            }

            const host = options.host ?? '127.0.0.1';
            const port = await allocatePort(host, usedPorts);
            usedPorts.add(port);
            reservations.set(name, { host, port });

            return createReservedPort(name, host, port);
        },

        env(values): Record<string, string | undefined> {
            ensureCleanup();
            const env: Record<string, string | undefined> = {};
            const details: Record<string, ReservedPortDetails> = {};

            for (const [key, value] of Object.entries(values)) {
                if (isReservedPort(value)) {
                    env[key] = String(value.port);
                    details[value.name] = { host: value.host, port: value.port, env: key };
                } else if (value === null || value === undefined) {
                    env[key] = undefined;
                } else {
                    env[key] = String(value);
                }
            }

            attachReservedPortDetails(env, details);

            return env;
        },
    };
}

function createReservedPort(name: string, host: string, port: number): ReservedPort {
    return {
        name,
        host,
        port,
        url(path = '', protocol = 'http') {
            const normalizedPath = path.length === 0 || path.startsWith('/') ? path : `/${path}`;
            return `${protocol}://${host}:${String(port)}${normalizedPath}`;
        },
        toString() {
            return String(port);
        },
    };
}

async function allocatePort(host: string, usedPorts: Set<number>): Promise<number> {
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const port = await listenOnEphemeralPort(host);
        if (!usedPorts.has(port)) {
            return port;
        }
    }

    throw new SmokeError('Could not allocate a unique local TCP port.', { host });
}

async function listenOnEphemeralPort(host: string): Promise<number> {
    const server = createServer();

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, host, resolve);
    });

    const address = server.address();
    if (typeof address !== 'object' || address === null) {
        throw new SmokeError('Could not read allocated local TCP port.', { host });
    }

    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

    return address.port;
}
