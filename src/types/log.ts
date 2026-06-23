import type { Probe } from './probe.js';

export interface LogContainsOptions {
    stream?: 'stdout' | 'stderr' | 'both';
}

export interface LogApi {
    (message: string): Promise<void>;
    contains(pattern: string | RegExp, options?: LogContainsOptions): Probe;
}
