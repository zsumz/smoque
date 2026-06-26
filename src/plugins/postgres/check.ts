import { SmokeError } from '../../errors.js';
import type { SmokeContext } from '../../types.js';
import { commandOptionsFrom } from './psql.js';
import type { PostgresCheckOptions, PostgresInfo } from './types.js';

export async function postgresCheck(t: SmokeContext, options: PostgresCheckOptions = {}): Promise<PostgresInfo> {
    const command = options.psql ?? 'psql';
    const commandOptions = commandOptionsFrom(t, options);
    const result = await t.cmd(command, ['--version'], { ...commandOptions, check: false });

    if (result.exitCode !== 0) {
        throw new SmokeError('Postgres psql client is not available.', {
            command,
            args: result.args,
            cwd: result.cwd,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            installHint: 'Install PostgreSQL client tools or pass { psql } with the path to a psql-compatible executable.',
        });
    }

    const info: PostgresInfo = {
        psql: { command },
    };
    const version = /\d+(?:\.\d+){0,2}/u.exec(result.stdout)?.[0];
    if (version !== undefined) {
        info.psql.version = version;
    }

    return info;
}
