import { relative, resolve } from 'node:path';

import { normalizePath } from '../path.js';
import { listDiscoveryFiles } from './discovery-files.js';

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
    return await listDiscoveryFiles(root, (name) => name.endsWith('.md'));
}

function isDefaultMarkdownFile(repoRoot: string, file: string): boolean {
    const relativePath = normalizePath(relative(repoRoot, file));
    return (
        ['README.md', 'USAGE.md', 'LLMS.md', 'PRIMITIVES.md'].includes(relativePath) ||
    relativePath.startsWith('docs/')
    );
}
