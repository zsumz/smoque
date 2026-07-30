import { readFile } from 'node:fs/promises';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import {
    isNotFoundError,
    writeTextFileWithParents,
} from '../../shared/fs.js';
import type { PathRef } from '../../types/path-ref.js';
import type { TextSnapshotExpectation } from '../types.js';
import { isSnapshotUpdateMode } from './update-mode.js';

export function createTextSnapshotExpectation(value: string): TextSnapshotExpectation {
    return new TextSnapshotExpectationImpl(value);
}

class TextSnapshotExpectationImpl implements TextSnapshotExpectation {
    constructor(private readonly value: string) {}

    public async toMatchSnapshot(path: string | PathRef): Promise<void> {
        const snapshotPath = pathToString(path);

        if (isSnapshotUpdateMode()) {
            await writeTextFileWithParents(snapshotPath, this.value);
            return;
        }

        const expected = await readTextSnapshot(snapshotPath);
        if (expected !== this.value) {
            const diff = diffText(expected, this.value);
            throw new SmokeError(`Text snapshot did not match: ${snapshotPath}`, {
                path: snapshotPath,
                diff,
            });
        }
    }
}

async function readTextSnapshot(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        if (isNotFoundError(error)) {
            throw new SmokeError(`Missing text snapshot: ${path}. Re-run with --update-snapshots to create it.`, {
                path,
                update: '--update-snapshots',
            });
        }
        throw error;
    }
}

function diffText(expected: string, actual: string): string {
    const expectedLines = expected.split(/\r?\n/u);
    const actualLines = actual.split(/\r?\n/u);
    const lines: string[] = [];
    const max = Math.max(expectedLines.length, actualLines.length);

    for (let index = 0; index < max && lines.length < 40; index += 1) {
        const expectedLine = expectedLines[index];
        const actualLine = actualLines[index];
        if (expectedLine === actualLine) {
            continue;
        }
        if (expectedLine !== undefined) {
            lines.push(`- ${String(index + 1)}: ${expectedLine}`);
        }
        if (actualLine !== undefined) {
            lines.push(`+ ${String(index + 1)}: ${actualLine}`);
        }
    }

    return lines.join('\n');
}
