import { SmokeError } from '../errors.js';
import type { NetApi, NetworkPolicyOptions } from '../types.js';

interface NetworkPolicyState {
    external: 'allow' | 'block';
    allow: Set<string>;
}

const policies: WeakMap<object, NetworkPolicyState> = new WeakMap();

export function createNetApi(context: object): NetApi {
    const state = getPolicy(context);

    return {
        policy(options: NetworkPolicyOptions): void {
            state.external = options.external ?? state.external;
            for (const host of normalizeHosts(options.allow)) {
                state.allow.add(host);
            }
        },
        allow(hosts: string | string[]): void {
            for (const host of normalizeHosts(hosts)) {
                state.allow.add(host);
            }
        },
    };
}

export function assertNetworkAllowed(context: object, method: string, url: string): void {
    const policy = getPolicy(context);
    const parsed = new URL(url);

    if (policy.external === 'allow' || isLocalHost(parsed.hostname) || policy.allow.has(parsed.hostname)) {
        return;
    }

    throw new SmokeError(`Blocked external network request: ${method.toUpperCase()} ${parsed.hostname}${parsed.pathname}`, {
        method: method.toUpperCase(),
        host: parsed.hostname,
        path: parsed.pathname,
        url: parsed.toString(),
    });
}

function getPolicy(context: object): NetworkPolicyState {
    let state = policies.get(context);
    if (!state) {
        state = {
            external: 'allow',
            allow: new Set(),
        };
        policies.set(context, state);
    }

    return state;
}

function normalizeHosts(input: string | string[] | undefined): string[] {
    if (input === undefined) {
        return [];
    }

    return (Array.isArray(input) ? input : [input]).map((host) => host.trim()).filter(Boolean);
}

export function isLocalHost(host: string): boolean {
    return (
        host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.startsWith('127.')
    );
}
