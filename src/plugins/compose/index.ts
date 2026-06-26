import { definePlugin } from '../../plugin.js';
import type { SmokePlugin } from '../../plugin.js';
import { composeCheck, type ComposeCheckOptions, type ComposeInfo } from './compose-check.js';
import {
    composeUp,
    type ComposeProject,
    type ComposeUpOptions,
} from './compose-project.js';

export type { ComposeCheckOptions, ComposeInfo } from './compose-check.js';
export type { ComposeLogsOptions, ComposeProject, ComposeUpOptions } from './compose-project.js';
export type { ComposeService, ComposeServiceReadyOptions } from './compose-service.js';
export type { ComposePortOptions, ComposePublishedPort } from './ports.js';

export interface ComposeApi {
    check(options?: ComposeCheckOptions): Promise<ComposeInfo>;
    up(options?: ComposeUpOptions): Promise<ComposeProject>;
}

declare module '../../types.js' {
    interface SmokeContext {
        compose: ComposeApi;
    }
}

export default function composePlugin(): SmokePlugin {
    return definePlugin({
        name: 'smoque:compose',
        version: '0.0.0',
        register(registry) {
            registry.action('compose.check', async (t, options) => composeCheck(t, options as ComposeCheckOptions | undefined));
            registry.resource('compose.up', async (t, options) => composeUp(t, options as ComposeUpOptions | undefined));
        },
    });
}
