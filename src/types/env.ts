import type { PathRef } from './common.js';

export interface EnvReader {
    string(name: string, options?: EnvStringOptions): string;
    int(name: string, options?: EnvIntOptions): number;
    path(name: string, options?: EnvPathOptions): PathRef;
    optional(name: string): string | undefined;
}

export interface EnvStringOptions {
    default?: string;
    required?: boolean;
    redact?: boolean;
}

export interface EnvIntOptions {
    default?: number;
    required?: boolean;
    min?: number;
    max?: number;
}

export interface EnvPathOptions {
    default?: string;
    required?: boolean;
}
