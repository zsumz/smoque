import type { DurationString } from './duration.js';
import type { ProcessHandle } from './process.js';

export interface PollOptions {
    timeout?: DurationString;
    interval?: DurationString;
}

export interface Probe {
    readonly description: string;
    check(process?: ProcessHandle): Promise<ProbeResult>;
}

export interface ProbeResult {
    ready: boolean;
    message?: string;
}
