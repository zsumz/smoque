import type { PortEnvValue, ReservedPort } from '../types.js';

const reservedPortsSymbol = Symbol.for('smoque.reservedPorts');

export interface ReservedPortDetails {
    host: string;
    port: number;
    env?: string;
}

export function attachReservedPortDetails(
    env: Record<string, string | undefined>,
    details: Record<string, ReservedPortDetails>,
): void {
    Object.defineProperty(env, reservedPortsSymbol, {
        enumerable: false,
        value: details,
    });
}

export function reservedPortsFromEnv(
    env: Record<string, string | undefined> | undefined,
): Record<string, ReservedPortDetails> | undefined {
    const value = (env as Record<symbol, unknown> | undefined)?.[reservedPortsSymbol];
    return isReservedPortDetailsMap(value) ? value : undefined;
}

export function isReservedPort(value: PortEnvValue): value is ReservedPort {
    return typeof value === 'object'
        && value !== null
        && 'name' in value
        && 'host' in value
        && 'port' in value
        && typeof value.name === 'string'
        && typeof value.host === 'string'
        && typeof value.port === 'number';
}

function isReservedPortDetailsMap(
    value: unknown,
): value is Record<string, ReservedPortDetails> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return Object.values(value as Record<string, unknown>).every((entry) =>
        typeof entry === 'object'
        && entry !== null
        && 'host' in entry
        && 'port' in entry
        && typeof entry.host === 'string'
        && typeof entry.port === 'number');
}
