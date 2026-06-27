import { readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { normalizePath } from '../path.js';

const ignoredDiscoveryDirectories = new Set([
    '.git',
    '.idea',
    '.tmp',
    '__MACOSX',
    'coverage',
    'dist',
    'node_modules',
    'target',
]);

export async function discoverMarkdownFiles(repoRoot: string, pattern: string | undefined): Promise<string[]> {
    const files = await listMarkdownFiles(repoRoot);
    if (!pattern) {
        return files.filter((file) => isDefaultMarkdownFile(repoRoot, file));
    }

    const target = resolve(repoRoot, pattern);
    const normalizedPattern = normalizePath(pattern);
    return files.filter((file) => {
        const relativePath = normalizePath(relative(repoRoot, file));
        return file === target || relativePath.includes(normalizedPattern) || file.endsWith(pattern);
    });
}

async function listMarkdownFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (ignoredDiscoveryDirectories.has(entry.name)) {
                continue;
            }
            files.push(...await listMarkdownFiles(resolve(root, entry.name)));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(resolve(root, entry.name));
        }
    }

    return files.sort();
}

function isDefaultMarkdownFile(repoRoot: string, file: string): boolean {
    const relativePath = normalizePath(relative(repoRoot, file));
    return (
        ['README.md', 'USAGE.md', 'LLMS.md', 'PRIMITIVES.md'].includes(relativePath) ||
    relativePath.startsWith('docs/')
    );
}
