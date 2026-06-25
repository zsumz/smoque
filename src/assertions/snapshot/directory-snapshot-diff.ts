import type { DirectorySnapshot, DirectorySnapshotEntry } from './types.js';

export interface DirectorySnapshotDiff {
    added: DirectorySnapshotEntry[];
    removed: DirectorySnapshotEntry[];
    changed: Array<{
        path: string;
        expected: DirectorySnapshotEntry;
        actual: DirectorySnapshotEntry;
    }>;
}

export function diffDirectorySnapshots(expected: DirectorySnapshot, actual: DirectorySnapshot): DirectorySnapshotDiff {
    const expectedByPath = new Map(expected.entries.map((entry) => [entry.path, entry]));
    const actualByPath = new Map(actual.entries.map((entry) => [entry.path, entry]));
    const added = actual.entries.filter((entry) => !expectedByPath.has(entry.path));
    const removed = expected.entries.filter((entry) => !actualByPath.has(entry.path));
    const changed = actual.entries.flatMap((entry) => {
        const expectedEntry = expectedByPath.get(entry.path);
        if (expectedEntry === undefined || JSON.stringify(expectedEntry) === JSON.stringify(entry)) {
            return [];
        }

        return [{
            path: entry.path,
            expected: expectedEntry,
            actual: entry,
        }];
    });

    return { added, removed, changed };
}
