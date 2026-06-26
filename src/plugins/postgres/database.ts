import { SmokeError } from '../../errors.js';
import type { CommandResult, SmokeContext } from '../../types.js';
import { parseCsv } from './csv.js';
import { postgresQueryError, postgresSqlError } from './errors.js';
import { basePsqlArgs, commandOptionsFrom, mergeSqlOptions, stripTrailingSemicolon } from './psql.js';
import type { PostgresDatabase, PostgresParamValue, PostgresQueryResult, PostgresSqlOptions } from './types.js';

export class PsqlDatabase implements PostgresDatabase {
    public readonly kind = 'postgres.database' as const;
    public readonly name = 'postgres';

    constructor(
        private readonly t: SmokeContext,
        private readonly psql: string,
        public readonly url: string,
        private readonly defaults: PostgresSqlOptions,
    ) {}

    public async sql(sql: string, options: PostgresSqlOptions = {}): Promise<CommandResult> {
        const merged = mergeSqlOptions(this.defaults, options);
        try {
            return await this.t.cmd(
                this.psql,
                [...basePsqlArgs(this.url, merged), '--command', sql],
                commandOptionsFrom(this.t, merged),
            );
        } catch (error) {
            throw postgresSqlError(error, sql, merged.params ?? {});
        }
    }

    public async query(sql: string, options: PostgresSqlOptions = {}): Promise<PostgresQueryResult> {
        const merged = mergeSqlOptions(this.defaults, options);
        const command = `copy (${stripTrailingSemicolon(sql)}) to stdout with csv header`;

        try {
            const result = await this.t.cmd(
                this.psql,
                [...basePsqlArgs(this.url, merged), '--command', command],
                commandOptionsFrom(this.t, merged),
            );

            return new PsqlQueryResult(sql, merged.params ?? {}, parseCsv(result.stdout), result.stdout);
        } catch (error) {
            throw postgresQueryError(error, sql, merged.params ?? {});
        }
    }

    public async cleanup(): Promise<void> {
        return Promise.resolve();
    }
}

class PsqlQueryResult implements PostgresQueryResult {
    constructor(
        public readonly sql: string,
        public readonly params: Record<string, PostgresParamValue>,
        public readonly rows: Array<Record<string, string>>,
        private readonly output: string,
    ) {}

    public expectRow(expected: Record<string, unknown>): PostgresQueryResult {
        const found = this.rows.some((row) => rowMatches(row, expected));
        if (!found) {
            throw new SmokeError('Expected Postgres query to return a matching row.', {
                sql: this.sql,
                params: this.params,
                expected,
                preview: previewRows(this.rows),
                output: bounded(this.output),
            });
        }

        return this;
    }

    public expectRows(expected: Array<Record<string, unknown>>): PostgresQueryResult {
        const actual = this.rows;
        const equal = actual.length === expected.length && expected.every((row, index) => rowMatches(actual[index] ?? {}, row));
        if (!equal) {
            throw new SmokeError('Expected Postgres query rows to match.', {
                sql: this.sql,
                params: this.params,
                expected,
                preview: previewRows(actual),
                output: bounded(this.output),
            });
        }

        return this;
    }
}

function rowMatches(actual: Record<string, string>, expected: Record<string, unknown>): boolean {
    return Object.entries(expected).every(([key, value]) => actual[key] === String(value));
}

function previewRows(rows: Array<Record<string, string>>): Array<Record<string, string>> {
    return rows.slice(0, 5);
}

function bounded(value: string): string {
    return value.length <= 2_000 ? value : `${value.slice(0, 2_000)}\n... truncated ...`;
}
