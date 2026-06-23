export type DurationString = `${number}ms` | `${number}s` | `${number}m`;

export interface PathRef {
    path(...parts: string[]): string;
    toString(): string;
}

export type ChecksumAlgorithm = 'sha1' | 'sha256' | 'sha512';
