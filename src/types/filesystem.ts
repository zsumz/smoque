import type { PathRef } from './common.js';
import type { Probe } from './probe.js';

export interface FileSystemApi {
    copy(from: string | PathRef, to: string | PathRef): Promise<void>;
    rm(path: string | PathRef, options?: SafeRemoveOptions): Promise<void>;
    mkdir(path: string | PathRef): Promise<void>;
    writeText(path: string | PathRef, value: string): Promise<void>;
    writeJson(path: string | PathRef, value: unknown): Promise<void>;
    readText(path: string | PathRef): Promise<string>;
    exists(path: string | PathRef): Promise<boolean>;
    ready(path: string | PathRef): Probe;
}

export interface WorkDirOptions {
    clean?: boolean;
    refuse?: Array<string | PathRef>;
    keepOnFail?: boolean;
}

export interface SafeRemoveOptions {
    recursive?: boolean;
    force?: boolean;
    refuse?: Array<string | PathRef>;
    refuseUnsafe?: boolean;
}
