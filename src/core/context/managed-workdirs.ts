import { createFileSystemApi, createTempDir, createWorkDir } from '../../filesystem.js';
import type { WorkDirOptions } from '../../types/filesystem.js';
import type { PathRef } from '../../types/path-ref.js';
import type { SmokeContextHost } from './smoke-context.js';

export async function createManagedTempDir(
    host: SmokeContextHost,
    name?: string,
): Promise<PathRef> {
    const dir = await createTempDir(name);
    host.addCleanup(async () => {
        if (host.keepWorkdirOnFail && host.preserveManagedWorkdirs()) {
            return;
        }
        await createFileSystemApi(host.root).rm(dir, { recursive: true, force: true });
    });
    return dir;
}

export async function createManagedWorkDir(
    host: SmokeContextHost,
    path: string,
    options: WorkDirOptions,
): Promise<PathRef> {
    const dir = await createWorkDir(host.root, path, options);
    host.addCleanup(async () => {
        if ((host.keepWorkdirOnFail || options.keepOnFail) && host.preserveManagedWorkdirs()) {
            return;
        }
        await createFileSystemApi(host.root).rm(dir, {
            recursive: true,
            force: true,
            refuse: [host.root, ...options.refuse ?? []],
        });
    });
    return dir;
}
