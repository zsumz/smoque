import { readdir, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export async function listMatchingFiles(
    root: string,
    patterns: readonly string[],
): Promise<string[]> {
    const files = await listFiles(root);
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

async function listFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const path = resolve(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(path));
        } else if (entry.isFile()) {
            files.push(path);
        } else if (entry.isSymbolicLink()) {
            const target = await stat(path);
            if (target.isFile()) {
                files.push(path);
            }
        }
    }

    return files.sort();
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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
