import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { hasErrorCode } from './errors.js';

export function isNotFoundError(error: unknown): boolean {
    return hasErrorCode(error, 'ENOENT');
}

export async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

export async function writeTextFileWithParents(
    path: string,
    value: string,
): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value, 'utf8');
}
