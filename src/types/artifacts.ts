import type { PathRef } from './common.js';

export interface Artifact {
    name: string;
    path: string;
    kind?: string;
}

export interface ArtifactSink {
    file(path: string | PathRef, name?: string): Promise<void> | void;
    dir(path: string | PathRef, name?: string): Promise<void> | void;
    text(name: string, value: string): Promise<void> | void;
}

export interface SmokeResource {
    readonly name: string;
    readonly kind: string;
    cleanup(): Promise<void>;
    attachOnFailure?(attach: ArtifactSink): Promise<void>;
}
