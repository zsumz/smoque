import { SmokeError } from '../../errors.js';
import type { DurationString, PollOptions, SmokeContext } from '../../types.js';
import type { ComposeUpOptions } from '../compose.js';
import { composeFileContents } from './compose-file.js';
import { postgresConnect } from './connect.js';
import type { PostgresConnectOptions, PostgresDatabase, PostgresSqlOptions, PostgresStartOptions } from './types.js';

export async function postgresStart(t: SmokeContext, options: PostgresStartOptions = {}): Promise<PostgresDatabase> {
    const compose = t.compose as typeof t.compose | undefined;
    if (!compose) {
        throw new SmokeError('Postgres start requires the smoque Compose plugin.', {
            expected: 'Use the bundled smoque import or register the compose plugin before postgres.',
        });
    }

    const database = options.database ?? 'app';
    const user = options.user ?? 'postgres';
    const password = options.password ?? 'postgres';
    const root = await t.tempDir('postgres-compose');
    const composeFile = root.path('compose.yaml');

    await t.fs.writeText(
        composeFile,
        composeFileContents({ database, user, password, image: options.image ?? 'postgres:16' }),
    );

    const composeOptions: ComposeUpOptions = {
        file: composeFile,
        services: ['postgres'],
    };
    if (options.docker !== undefined) {
        composeOptions.docker = options.docker;
    }
    if (options.projectName !== undefined) {
        composeOptions.projectName = options.projectName;
    }
    if (options.timeout !== undefined) {
        composeOptions.timeout = options.timeout;
    }

    const stack = await compose.up(composeOptions);
    const published = await stack.service('postgres').port(5432);
    const url = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${published.host}:${String(published.port)}/${encodeURIComponent(database)}`;
    const connectOptions: PostgresConnectOptions = {
        url,
    };
    if (options.psql !== undefined) {
        connectOptions.psql = options.psql;
    }
    if (options.cwd !== undefined) {
        connectOptions.cwd = options.cwd;
    }
    if (options.env !== undefined) {
        connectOptions.env = options.env;
    }
    if (options.timeout !== undefined) {
        connectOptions.timeout = options.timeout;
    }

    const db = await postgresConnect(t, connectOptions);

    await waitForDatabase(t, db, options.timeout);
    return db;
}

async function waitForDatabase(
    t: SmokeContext,
    db: PostgresDatabase,
    timeout: DurationString | undefined,
): Promise<void> {
    const queryOptions: PostgresSqlOptions = {};
    const pollOptions: PollOptions = {};
    if (timeout !== undefined) {
        queryOptions.timeout = timeout;
        pollOptions.timeout = timeout;
    }
    await t.poll('Postgres readiness', async () => db.query('select 1 as ok', queryOptions), pollOptions);
}
