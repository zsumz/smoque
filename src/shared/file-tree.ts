import { glob, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const allEntryPatterns = [
    '**/*',
    '**/.*',
    '**/.*/**/{*,.*}',
];

export interface FileTreeOptions {
    excludeDirectoryNames?: ReadonlySet<string>;
    includeFileSymlinks?: boolean;
}

export async function listFilesInTree(
    root: string,
    options: FileTreeOptions = {},
): Promise<string[]> {
    await readdir(root);
    const files: string[] = [];
    const entries = glob(allEntryPatterns, {
        cwd: root,
        withFileTypes: true,
        exclude: (entry) =>
            entry.isDirectory() &&
            options.excludeDirectoryNames?.has(entry.name) === true,
    });

    for await (const entry of entries) {
        const path = resolve(entry.parentPath, entry.name);
        if (entry.isFile() || await isIncludedFileSymlink(path, entry.isSymbolicLink(), options)) {
            files.push(path);
        }
    }
    return files.sort();
}

async function isIncludedFileSymlink(
    path: string,
    isSymbolicLink: boolean,
    options: FileTreeOptions,
): Promise<boolean> {
    return options.includeFileSymlinks === true
        && isSymbolicLink
        && (await stat(path)).isFile();
}
