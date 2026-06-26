import { SmokeError } from '../../errors.js';
import type { PostgresParamValue } from './types.js';

export function postgresQueryError(
    error: unknown,
    sql: string,
    params: Record<string, PostgresParamValue>,
): SmokeError {
    if (error instanceof SmokeError) {
        return new SmokeError(`Postgres query failed: ${error.message}`, {
            ...error.details,
            sql,
            params,
        });
    }

    return new SmokeError(`Postgres query failed: ${String(error)}`, {
        sql,
        params,
    });
}

export function postgresSqlError(
    error: unknown,
    sql: string,
    params: Record<string, PostgresParamValue>,
): SmokeError {
    if (error instanceof SmokeError) {
        return new SmokeError(`Postgres SQL command failed: ${error.message}`, {
            ...error.details,
            sql,
            params,
        });
    }

    return new SmokeError(`Postgres SQL command failed: ${String(error)}`, {
        sql,
        params,
    });
}
