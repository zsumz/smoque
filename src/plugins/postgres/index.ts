import { definePlugin } from '../../plugin.js';
import type { SmokePlugin } from '../../plugin.js';
import { postgresCheck } from './check.js';
import { postgresConnect } from './connect.js';
import { postgresStart } from './start.js';
import type {
    PostgresCheckOptions,
    PostgresConnectOptions,
    PostgresDatabase,
    PostgresInfo,
    PostgresStartOptions,
} from './types.js';

export type {
    PostgresCheckOptions,
    PostgresConnectOptions,
    PostgresDatabase,
    PostgresInfo,
    PostgresParamValue,
    PostgresQueryResult,
    PostgresSqlOptions,
    PostgresStartOptions,
} from './types.js';

export interface PostgresApi {
    check(options?: PostgresCheckOptions): Promise<PostgresInfo>;
    connect(options: PostgresConnectOptions): Promise<PostgresDatabase>;
    start(options?: PostgresStartOptions): Promise<PostgresDatabase>;
}

declare module '../../types.js' {
    interface SmokeContext {
        postgres: PostgresApi;
    }
}

export default function postgresPlugin(): SmokePlugin {
    return definePlugin({
        name: 'smoque:postgres',
        version: '0.0.0',
        register(registry) {
            registry.action('postgres.check', async (t, options) => postgresCheck(t, options as PostgresCheckOptions | undefined));
            registry.resource('postgres.connect', async (t, options) => postgresConnect(t, options as PostgresConnectOptions));
            registry.resource('postgres.start', async (t, options) => postgresStart(t, options as PostgresStartOptions | undefined));
        },
    });
}
