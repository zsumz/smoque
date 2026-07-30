import { glob, readdir } from 'node:fs/promises';
import path from 'node:path';

const allEntryPatterns = [
    '**/*',
    '**/.*',
    '**/.*/**/{*,.*}',
];

export async function collectModuleFiles(directory: string): Promise<string[]> {
    return collectFiles(directory, (name) => name.endsWith('.ts') || name.endsWith('.mts'));
}

export async function collectAllFiles(directory: string): Promise<string[]> {
    return collectFiles(directory, () => true);
}

export async function collectJavaScriptModuleFiles(directory: string): Promise<string[]> {
    return collectFiles(directory, isJavaScriptModule);
}

export async function collectDirectJavaScriptModuleFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && isJavaScriptModule(entry.name))
        .map((entry) => path.join(directory, entry.name));
}

async function collectFiles(
    directory: string,
    accepts: (name: string) => boolean,
): Promise<string[]> {
    await readdir(directory);
    const files: string[] = [];

    for await (const entry of glob(allEntryPatterns, {
        cwd: directory,
        withFileTypes: true,
    })) {
        if (entry.isFile() && accepts(entry.name)) {
            files.push(path.join(entry.parentPath, entry.name));
        }
    }
    return files.sort();
}

export function relativePath(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}

export function isJavaScriptModule(name: string): boolean {
    return name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.cjs');
}
