import { createServer } from 'node:net';

import { SmokeError } from './errors.js';
import type { PortEnvValue, PortReserveOptions, PortsApi, ReservedPort } from './types.js';

const reservedPortsSymbol = Symbol.for('smoque.reservedPorts');

interface ReservedPortDetails {
    host: string;
    port: number;
    env?: string;
}

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

            Object.defineProperty(env, reservedPortsSymbol, {
                enumerable: false,
                value: details,
            });

            return env;
        },
    };
}

export function reservedPortsFromEnv(
    env: Record<string, string | undefined> | undefined,
): Record<string, ReservedPortDetails> | undefined {
    const value = (env as Record<symbol, unknown> | undefined)?.[reservedPortsSymbol];
    if (isReservedPortDetailsMap(value)) {
        return value;
    }
    return undefined;
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

function isReservedPort(value: PortEnvValue): value is ReservedPort {
    return typeof value === 'object'
    && value !== null
    && 'name' in value
    && 'host' in value
    && 'port' in value
    && typeof value.name === 'string'
    && typeof value.host === 'string'
    && typeof value.port === 'number';
}

function isReservedPortDetailsMap(value: unknown): value is Record<string, ReservedPortDetails> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return Object.values(value as Record<string, unknown>).every((entry) =>
        typeof entry === 'object'
    && entry !== null
    && 'host' in entry
    && 'port' in entry
    && typeof entry.host === 'string'
    && typeof entry.port === 'number',
    );
}
