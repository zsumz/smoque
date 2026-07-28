import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function collectModuleFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectModuleFiles(absolute));
        } else if (
            entry.isFile()
            && (entry.name.endsWith('.ts') || entry.name.endsWith('.mts'))
        ) {
            files.push(absolute);
        }
    }
    return files;
}

export function relativePath(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}
