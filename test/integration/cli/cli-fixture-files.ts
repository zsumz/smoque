import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function findFiles(
    root: string,
    basename: string,
    withinCandidate = false,
): Promise<string[]> {
    const matches: string[] = [];
    let entries;
    try {
        entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
        if (isErrnoException(error) && error.code === 'ENOENT') {
            return matches;
        }
        throw error;
    }

    for (const entry of entries) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) {
            const shouldDescend = withinCandidate || entry.name.startsWith('smoque-');
            if (shouldDescend) {
                matches.push(...await findFiles(path, basename, true));
            }
        } else if (entry.name === basename) {
            matches.push(path);
        }
    }

    return matches;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}
