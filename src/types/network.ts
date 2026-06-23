import type { DurationString } from './common.js';
import type { Probe } from './probe.js';

export interface NetApi {
    policy(options: NetworkPolicyOptions): void;
    allow(hosts: string | string[]): void;
}

export interface NetworkPolicyOptions {
    external?: 'allow' | 'block';
    allow?: string | string[];
}

export interface TcpReadyOptions {
    host?: string;
    port: number;
    timeout?: DurationString;
}

export interface TcpApi {
    ready(options: TcpReadyOptions): Probe;
    ready(port: number, options?: Omit<TcpReadyOptions, 'port'>): Probe;
}
