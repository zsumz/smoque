import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import { isNotFoundError } from '../../shared/fs.js';
import { isRecord } from '../../shared/objects.js';
import type { ChecksumAlgorithm, PathRef } from '../../types.js';
import type { DirectorySnapshotExpectation, DirectorySnapshotOptions } from '../types.js';
import { diffDirectorySnapshots } from './directory-snapshot-diff.js';
import type { DirectorySnapshot, DirectorySnapshotEntry } from './types.js';
import { isSnapshotUpdateMode } from './update-mode.js';

export function createDirectorySnapshotExpectation(root: string | PathRef): DirectorySnapshotExpectation {
    return new DirectorySnapshotExpectationImpl(pathToString(root));
}

class DirectorySnapshotExpectationImpl implements DirectorySnapshotExpectation {
    constructor(private readonly root: string) {}

    public async toMatchSnapshot(path: string | PathRef, options: DirectorySnapshotOptions = {}): Promise<void> {
        const snapshotPath = pathToString(path);
        const actual = await createDirectorySnapshot(this.root, snapshotPath, options);
        const serialized = `${JSON.stringify(actual, null, 2)}\n`;

        if (isSnapshotUpdateMode()) {
            await writeSnapshot(snapshotPath, serialized);
            return;
        }

        const rawExpected = await readSnapshot(snapshotPath, 'directory');
        const expected = parseDirectorySnapshot(rawExpected, snapshotPath);
        const diff = diffDirectorySnapshots(expected, actual);

        if (diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0) {
            throw new SmokeError(`Directory snapshot did not match: ${snapshotPath}`, {
                path: snapshotPath,
                root: this.root,
                added: diff.added,
                removed: diff.removed,
                changed: diff.changed,
            });
        }
    }
}

async function createDirectorySnapshot(
    root: string,
    snapshotPath: string,
    options: DirectorySnapshotOptions,
): Promise<DirectorySnapshot> {
    const checksum = normalizeSnapshotChecksum(options.checksum);
    const entries = await listDirectorySnapshotEntries(root, root, snapshotPath, checksum);

    return {
        schemaVersion: 'smoque.directory-snapshot.v1',
        entries,
    };
}

async function listDirectorySnapshotEntries(
    root: string,
    current: string,
    snapshotPath: string,
    checksum: ChecksumAlgorithm | undefined,
): Promise<DirectorySnapshotEntry[]> {
    const entries = await readdir(current, { withFileTypes: true });
    const snapshotEntries: DirectorySnapshotEntry[] = [];

    for (const entry of entries) {
        const path = resolve(current, entry.name);
        if (path === snapshotPath) {
            continue;
        }

        const relativePath = normalizePath(relative(root, path));
        if (entry.isDirectory()) {
            snapshotEntries.push({ path: relativePath, kind: 'dir', size: 0 });
            snapshotEntries.push(...await listDirectorySnapshotEntries(root, path, snapshotPath, checksum));
        } else if (entry.isFile()) {
            const fileStat = await stat(path);
            const snapshotEntry: DirectorySnapshotEntry = {
                path: relativePath,
                kind: 'file',
                size: fileStat.size,
            };
            if (checksum !== undefined) {
                snapshotEntry.checksum = {
                    algorithm: checksum,
                    value: createHash(checksum).update(await readFile(path)).digest('hex'),
                };
            }
            snapshotEntries.push(snapshotEntry);
        }
    }

    return snapshotEntries.sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeSnapshotChecksum(checksum: DirectorySnapshotOptions['checksum']): ChecksumAlgorithm | undefined {
    if (checksum === true) {
        return 'sha256';
    }
    if (checksum === false || checksum === undefined) {
        return undefined;
    }
    return checksum;
}

function parseDirectorySnapshot(raw: string, snapshotPath: string): DirectorySnapshot {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new SmokeError(`Directory snapshot is not valid JSON: ${snapshotPath}`, { path: snapshotPath });
    }

    if (!isRecord(parsed) || parsed.schemaVersion !== 'smoque.directory-snapshot.v1' || !Array.isArray(parsed.entries)) {
        throw new SmokeError(`Directory snapshot has an unsupported format: ${snapshotPath}`, { path: snapshotPath });
    }

    return {
        schemaVersion: 'smoque.directory-snapshot.v1',
        entries: parsed.entries as DirectorySnapshotEntry[],
    };
}

async function readSnapshot(path: string, kind: 'directory' | 'text'): Promise<string> {
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        if (isNotFoundError(error)) {
            throw new SmokeError(`Missing ${kind} snapshot: ${path}. Re-run with --update-snapshots to create it.`, {
                path,
                update: '--update-snapshots',
            });
        }
        throw error;
    }
}

async function writeSnapshot(path: string, value: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value, 'utf8');
}

function normalizePath(path: string): string {
    return path.replace(/\\/gu, '/');
}
