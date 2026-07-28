import type { PathRef, SmokeResource } from '../../types.js';
import type { ComposeCheckOptions } from './compose-check.js';
import type { ComposeService } from './compose-service.js';

export interface ComposeUpOptions extends ComposeCheckOptions {
    file?: string | PathRef | Array<string | PathRef>;
    projectName?: string;
    services?: string[];
    removeVolumes?: boolean;
}

export interface ComposeProject extends SmokeResource {
    readonly kind: 'compose.project';
    readonly projectName: string;
    readonly cwd: string;
    readonly files: string[];
    service(name: string): ComposeService;
    logs(options?: ComposeLogsOptions): Promise<string>;
    down(): Promise<void>;
}

export interface ComposeLogsOptions {
    services?: string[];
}
