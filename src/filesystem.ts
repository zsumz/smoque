import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, parse, relative, resolve } from 'node:path';

import { UnsafePathError } from './errors.js';
import { pathToString, resolveContextPath, toPathRef } from './path-ref.js';
import { isNotFoundError } from './shared/fs.js';
import type { FileSystemApi, PathRef, Probe, SafeRemoveOptions, WorkDirOptions } from './types.js';

export function createFileSystemApi(repoRoot: PathRef): FileSystemApi {
    return {
        async copy(from, to): Promise<void> {
            await cp(resolveContextPath(repoRoot, from), resolveContextPath(repoRoot, to), { recursive: true });
        },
        async rm(path, options = {}): Promise<void> {
            assertSafeRemove(path, repoRoot, options);
            await rm(resolveContextPath(repoRoot, path), {
                recursive: options.recursive ?? false,
                force: options.force ?? false,
            });
        },
        async mkdir(path): Promise<void> {
            await mkdir(resolveContextPath(repoRoot, path), { recursive: true });
        },
        async writeText(path, value): Promise<void> {
            const destination = resolveContextPath(repoRoot, path);
            await mkdir(dirname(destination), { recursive: true });
            await writeFile(destination, value, 'utf8');
        },
        async writeJson(path, value): Promise<void> {
            const destination = resolveContextPath(repoRoot, path);
            await mkdir(dirname(destination), { recursive: true });
            await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        },
        async readText(path): Promise<string> {
            return await readFile(resolveContextPath(repoRoot, path), 'utf8');
        },
        async exists(path): Promise<boolean> {
            return await pathExists(resolveContextPath(repoRoot, path));
        },
        ready(path): Probe {
            const target = resolveContextPath(repoRoot, path);
            return {
                description: `path exists: ${target}`,
                async check() {
                    return {
                        ready: await pathExists(target),
                        message: target,
                    };
                },
            };
        },
    };
}

export async function createTempDir(name = 'suite'): Promise<PathRef> {
    const safeName = name.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'suite';
    return toPathRef(await mkdtemp(resolve(tmpdir(), `smoque-${safeName}-`)));
}

export async function createWorkDir(repoRoot: PathRef, path: string, options: WorkDirOptions = {}): Promise<PathRef> {
    const workDir = toPathRef(path, repoRoot);
    const fs = createFileSystemApi(repoRoot);
    assertSafeRemove(workDir, repoRoot, { refuse: [repoRoot, ...options.refuse ?? []] });

    if (options.clean) {
        await fs.rm(workDir, {
            recursive: true,
            force: true,
            refuse: [repoRoot, ...options.refuse ?? []],
        });
    }

    await fs.mkdir(workDir);
    return workDir;
}

function assertSafeRemove(path: string | PathRef, repoRoot: PathRef, options: SafeRemoveOptions): void {
    if (options.refuseUnsafe === false) {
        return;
    }

    const raw = typeof path === 'string' ? path.trim() : path.toString();
    const target = resolveContextPath(repoRoot, path);
    const root = parse(target).root;
    const repoRootPath = pathToString(repoRoot);
    const refused = [
        '',
        '.',
        root,
        repoRootPath,
        resolve(homedir()),
        ...(options.refuse ?? []).map((refusedPath) => resolveContextPath(repoRoot, refusedPath)),
    ];

    if (
        refused.some((refusedPath) => raw === refusedPath || target === refusedPath) ||
    isAncestorOf(target, repoRootPath)
    ) {
        throw new UnsafePathError(`Refusing to remove unsafe path: ${raw || '<empty>'}`, {
            path: raw || '<empty>',
            resolvedPath: target,
        });
    }
}

function isAncestorOf(path: string, child: string): boolean {
    const result = relative(path, child);
    return result !== '' && !result.startsWith('..') && !isAbsolute(result);
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}
