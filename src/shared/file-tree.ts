import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface FileTreeOptions {
    excludeDirectoryNames?: ReadonlySet<string>;
    includeFileSymlinks?: boolean;
}

export async function listFilesInTree(
    root: string,
    options: FileTreeOptions = {},
): Promise<string[]> {
    const files: string[] = [];
    await collectFiles(resolve(root), files, options);
    return files.sort();
}

async function collectFiles(
    directory: string,
    files: string[],
    options: FileTreeOptions,
): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            if (options.excludeDirectoryNames?.has(entry.name) !== true) {
                await collectFiles(path, files, options);
            }
            continue;
        }
        if (entry.isFile() || await isIncludedFileSymlink(path, entry.isSymbolicLink(), options)) {
            files.push(path);
        }
    }
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
