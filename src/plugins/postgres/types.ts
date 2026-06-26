import type { CommandResult, DurationString, PathRef, SmokeResource } from '../../types.js';

export interface PostgresCheckOptions {
    psql?: string;
    cwd?: string | PathRef;
    env?: Record<string, string | undefined>;
    timeout?: DurationString;
}

export interface PostgresInfo {
    psql: {
        command: string;
        version?: string;
    };
}

export interface PostgresConnectOptions extends PostgresCheckOptions {
    url?: string;
}

export interface PostgresStartOptions extends PostgresCheckOptions {
    docker?: string;
    image?: string;
    database?: string;
    user?: string;
    password?: string;
    projectName?: string;
}

export interface PostgresSqlOptions {
    params?: Record<string, PostgresParamValue>;
    cwd?: string | PathRef;
    env?: Record<string, string | undefined>;
    timeout?: DurationString;
}

export type PostgresParamValue = string | number | boolean | null;

export interface PostgresDatabase extends SmokeResource {
    readonly url: string;
    sql(sql: string, options?: PostgresSqlOptions): Promise<CommandResult>;
    query(sql: string, options?: PostgresSqlOptions): Promise<PostgresQueryResult>;
}

export interface PostgresQueryResult {
    readonly sql: string;
    readonly params: Record<string, PostgresParamValue>;
    readonly rows: Array<Record<string, string>>;
    expectRow(expected: Record<string, unknown>): PostgresQueryResult;
    expectRows(expected: Array<Record<string, unknown>>): PostgresQueryResult;
}
