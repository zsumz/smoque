import { listArchiveEntries } from '../expectations.js';
import { definePlugin } from '../plugin.js';
import type { SmokePlugin } from '../plugin.js';
import type { PathRef } from '../types.js';

export interface ArchiveApi {
    list(path: string | PathRef): Promise<string[]>;
}

declare module '../types.js' {
    interface SmokeContext {
        archive: ArchiveApi;
    }
}

export default function archivePlugin(): SmokePlugin {
    return definePlugin({
        name: 'smoque:archive',
        version: '0.0.0',
        register(registry) {
            registry.action('archive.list', async (_t, path) => listArchiveEntries(path as string | PathRef));
        },
    });
}
