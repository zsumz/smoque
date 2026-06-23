import type { DurationString, PathRef } from './common.js';

export interface CommandOptions {
    cwd?: string | PathRef;
    env?: Record<string, string | undefined>;
    timeout?: DurationString;
    check?: boolean;
    stdin?: string | Uint8Array;
    stdout?: 'capture' | 'inherit' | 'ignore';
    stderr?: 'capture' | 'inherit' | 'ignore';
    shell?: boolean;
}

export interface CommandResult {
    command: string;
    args: string[];
    cwd: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
}
