import { readdir, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { normalizePath } from '../path.js';
import { registerBundledRuntimeResolver } from './bundled-runtime-resolver.js';

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

export async function discoverSmokeFiles(repoRoot: string, pattern?: string): Promise<string[]> {
    const files = await listSmokeFiles(repoRoot);
    if (!pattern) {
        return files;
    }

    const normalizedPattern = normalizeRelativePattern(pattern);
    const allowLoosePathFragment = !/[\\/]$/u.test(pattern);
    const absolutePattern = normalizePath(resolve(repoRoot, pattern));
    const realAbsolutePattern = await realPathIfExists(absolutePattern);
    const candidates = await Promise.all(
        files.map(async (file) => ({
            file,
            realFile: await realPathIfExists(file),
        })),
    );

    return candidates
        .filter(({ file, realFile }) =>
            matchesSmokeFilePath(
                file,
                realFile,
                repoRoot,
                normalizedPattern,
                absolutePattern,
                realAbsolutePattern,
                allowLoosePathFragment,
            ),
        )
        .map(({ file }) => file);
}

export function isPathLikeSmokePattern(pattern: string | undefined): pattern is string {
    return (
        pattern !== undefined &&
    (pattern.includes('/') ||
      pattern.includes('\\') ||
      /\.smoke\.(?:js|mjs|ts|mts)$/u.test(pattern))
    );
}

export async function importSmokeFiles(files: string[]): Promise<void> {
    registerBundledRuntimeResolver();

    for (const file of files) {
        // This loader is the sole architecture-allowlisted nonliteral import boundary.
        await import(pathToFileURL(file).href);
    }
}

async function listSmokeFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (ignoredDiscoveryDirectories.has(entry.name)) {
                continue;
            }
            files.push(...await listSmokeFiles(resolve(root, entry.name)));
        } else if (entry.isFile() && isSmokeFile(entry.name)) {
            files.push(resolve(root, entry.name));
        }
    }

    return files.sort();
}

function isSmokeFile(path: string): boolean {
    return /\.(?:smoke)\.(?:js|mjs|ts|mts)$/u.test(path);
}

function normalizeRelativePattern(pattern: string): string {
    return normalizePath(pattern).replace(/^\.\/+/u, '').replace(/\/+$/u, '');
}

async function realPathIfExists(path: string): Promise<string | undefined> {
    try {
        return normalizePath(await realpath(path));
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

function matchesSmokeFilePath(
    file: string,
    realFile: string | undefined,
    repoRoot: string,
    normalizedPattern: string,
    absolutePattern: string,
    realAbsolutePattern: string | undefined,
    allowLoosePathFragment: boolean,
): boolean {
    const normalizedFile = normalizePath(file);
    const relativePath = normalizePath(relative(repoRoot, file));

    return (
        normalizedFile === absolutePattern ||
    normalizedFile.startsWith(`${absolutePattern}/`) ||
    realFile !== undefined &&
      realAbsolutePattern !== undefined &&
      (realFile === realAbsolutePattern || realFile.startsWith(`${realAbsolutePattern}/`)) ||
    relativePath === normalizedPattern ||
    relativePath.startsWith(`${normalizedPattern}/`) ||
    allowLoosePathFragment && normalizedPattern !== '' && relativePath.includes(normalizedPattern) ||
    relativePath.endsWith(`/${normalizedPattern}`)
    );
}
