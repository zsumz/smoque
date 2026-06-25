import type { ChecksumAlgorithm } from '../../types.js';

export interface DirectorySnapshot {
    schemaVersion: 'smoque.directory-snapshot.v1';
    entries: DirectorySnapshotEntry[];
}

export interface DirectorySnapshotEntry {
    path: string;
    kind: 'dir' | 'file';
    size: number;
    checksum?: {
        algorithm: ChecksumAlgorithm;
        value: string;
    };
}
