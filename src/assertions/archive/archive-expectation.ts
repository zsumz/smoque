import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import type { PathRef } from '../../types.js';
import type { ArchiveExpectation } from '../types.js';
import { listTarEntries } from './tar.js';
import { isZipArchive, listZipEntries } from './zip.js';

export function createArchiveExpectation(path: string | PathRef): ArchiveExpectation {
    return new ArchiveExpectationImpl(pathToString(path));
}

export async function listArchiveEntries(path: string | PathRef): Promise<string[]> {
    const archivePath = pathToString(path);
    const raw = await readFile(archivePath);
    const buffer = shouldGunzip(archivePath) ? gunzipSync(raw) : raw;
    const entries = isZipArchive(buffer) ? listZipEntries(buffer, archivePath) : listTarEntries(buffer, archivePath);

    return [...new Set(entries.map(normalizePath).map(stripDotSlash).filter(Boolean))].sort();
}

class ArchiveExpectationImpl implements ArchiveExpectation {
    public readonly not = {
        toContainEntries: async (expectedEntries: string[]): Promise<void> => {
            const entries = await listArchiveEntries(this.path);
            const forbidden = expectedEntries.map(normalizePath).map(stripDotSlash).filter((entry) => entries.includes(entry));

            if (forbidden.length > 0) {
                throw new SmokeError(`Expected archive not to contain entries: ${forbidden.join(', ')}`, {
                    path: this.path,
                    entries: excerpt(entries),
                    forbidden,
                });
            }
        },
    };

    constructor(private readonly path: string) {}

    public async toContainEntries(expectedEntries: string[]): Promise<void> {
        const entries = await listArchiveEntries(this.path);
        const missing = expectedEntries.map(normalizePath).map(stripDotSlash).filter((entry) => !entries.includes(entry));

        if (missing.length > 0) {
            throw new SmokeError(`Expected archive to contain entries: ${missing.join(', ')}`, {
                path: this.path,
                entries: excerpt(entries),
                missing,
            });
        }
    }
}

function shouldGunzip(path: string): boolean {
    return path.endsWith('.tgz') || path.endsWith('.tar.gz') || extname(path) === '.gz';
}

function stripDotSlash(path: string): string {
    return path.replace(/^\.\//u, '');
}

function excerpt(values: string[]): string[] {
    return values.slice(0, 50);
}

function normalizePath(path: string): string {
    return path.replace(/\\/gu, '/');
}
