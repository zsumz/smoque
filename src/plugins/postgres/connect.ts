import { SmokeError } from '../../errors.js';
import type { SmokeContext } from '../../types.js';
import { postgresCheck } from './check.js';
import { PsqlDatabase } from './database.js';
import { redactUrl } from './psql.js';
import type { PostgresConnectOptions, PostgresDatabase } from './types.js';

export async function postgresConnect(t: SmokeContext, options: PostgresConnectOptions): Promise<PostgresDatabase> {
    if (!options.url) {
        throw new SmokeError('Postgres connection requires a database URL.', {
            expected: 'postgres.connect({ url })',
        });
    }

    redactUrl(t, options.url);
    const info = await postgresCheck(t, options);
    return new PsqlDatabase(t, info.psql.command, options.url, options);
}
