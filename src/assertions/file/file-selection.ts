import { relative } from 'node:path';

import { listFilesInTree } from '../../shared/file-tree.js';
import { escapeRegExp } from '../../shared/text-pattern.js';

export async function listMatchingFiles(
    root: string,
    patterns: readonly string[],
): Promise<string[]> {
    const files = await listFilesInTree(root, {
        includeFileSymlinks: true,
    });
    if (patterns.length === 0) {
        return files;
    }

    return files.filter((file) => {
        const relativePath = normalizeFilePath(relative(root, file));
        return patterns.some((pattern) => globToRegExp(pattern).test(relativePath));
    });
}

export function normalizeFilePath(path: string): string {
    return path.replace(/\\/gu, '/');
}

function globToRegExp(pattern: string): RegExp {
    const normalized = normalizeFilePath(pattern);
    let source = '';

    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        const next = normalized[index + 1];

        if (char === '*' && next === '*') {
            if (normalized[index + 2] === '/') {
                source += '(?:.*\\/)?';
                index += 2;
            } else {
                source += '.*';
                index += 1;
            }
        } else if (char === '*') {
            source += '[^/]*';
        } else if (char === '?') {
            source += '[^/]';
        } else {
            source += escapeRegExp(char ?? '');
        }
    }

    return new RegExp(`^${source}$`, 'u');
}
