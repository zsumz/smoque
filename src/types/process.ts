import type { SmokeResource } from './artifacts.js';
import type { CommandOptions } from './command.js';
import type { Probe } from './probe.js';

export interface ProcessStartOptions extends CommandOptions {
    ready?: Probe;
    name?: string;
}

export interface ProcessApi {
    start(command: string, args?: string[], options?: ProcessStartOptions): Promise<ProcessHandle>;
    group(name?: string): ProcessGroup;
}

export type ProcessGroupStartOptions = Omit<ProcessStartOptions, 'name'>;

export interface ProcessGroup extends SmokeResource {
    start(name: string, command: string, args?: string[], options?: ProcessGroupStartOptions): Promise<ProcessHandle>;
    stop(signal?: string): Promise<void>;
    get(name: string): ProcessHandle | undefined;
}

export interface ProcessHandle extends SmokeResource {
    readonly pid: number | undefined;
    stdout(): string;
    stderr(): string;
    stop(signal?: string): Promise<void>;
}
