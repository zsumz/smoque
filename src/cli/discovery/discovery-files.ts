import { basename } from 'node:path';

import { listFilesInTree } from '../../shared/file-tree.js';

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

export async function listDiscoveryFiles(
    root: string,
    accepts: (name: string) => boolean,
): Promise<string[]> {
    const files = await listFilesInTree(root, {
        excludeDirectoryNames: ignoredDiscoveryDirectories,
    });
    return files.filter((file) => accepts(basename(file)));
}
