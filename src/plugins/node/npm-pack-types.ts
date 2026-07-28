import type { PathRef } from '../../types/path-ref.js';

export interface NpmPackOptions {
    cwd?: string | PathRef;
    destination?: string | PathRef;
    cache?: string | PathRef;
    scripts?: 'allow' | 'ignore';
    ignoreScripts?: boolean;
}

export interface PackedArtifact {
    filename: string;
    path: string;
    packageName?: string;
    version?: string;
}

export interface NpmPackJson {
    filename: string;
    name?: string;
    version?: string;
}
