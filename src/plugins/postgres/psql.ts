import { pathToString } from '../../path-ref.js';
import type { CommandOptions, SmokeContext } from '../../types.js';
import type { PostgresCheckOptions, PostgresParamValue, PostgresSqlOptions } from './types.js';

export function basePsqlArgs(url: string, options: PostgresSqlOptions): string[] {
    const args = [url, '--no-psqlrc', '--set', 'ON_ERROR_STOP=1'];
    for (const [key, value] of Object.entries(options.params ?? {})) {
        args.push('--set', `${key}=${paramToString(value)}`);
    }
    return args;
}

export function commandOptionsFrom(t: SmokeContext, options: PostgresCheckOptions | PostgresSqlOptions): CommandOptions {
    const commandOptions: CommandOptions = {
        cwd: pathToString(options.cwd ?? t.repoRoot()),
    };
    if (options.env !== undefined) {
        commandOptions.env = options.env;
    }
    if (options.timeout !== undefined) {
        commandOptions.timeout = options.timeout;
    }
    return commandOptions;
}

export function mergeSqlOptions(defaults: PostgresSqlOptions, options: PostgresSqlOptions): PostgresSqlOptions {
    const merged: PostgresSqlOptions = {};
    const cwd = options.cwd ?? defaults.cwd;
    if (cwd !== undefined) {
        merged.cwd = cwd;
    }
    const env = { ...defaults.env ?? {}, ...options.env ?? {} };
    if (Object.keys(env).length > 0) {
        merged.env = env;
    }
    const timeout = options.timeout ?? defaults.timeout;
    if (timeout !== undefined) {
        merged.timeout = timeout;
    }
    const params = { ...defaults.params ?? {}, ...options.params ?? {} };
    if (Object.keys(params).length > 0) {
        merged.params = params;
    }
    return merged;
}

export function redactUrl(t: SmokeContext, url: string): void {
    t.redact(url);
    try {
        const parsed = new URL(url);
        if (parsed.password) {
            t.redact(decodeURIComponent(parsed.password));
        }
    } catch {
        return;
    }
}

export function stripTrailingSemicolon(sql: string): string {
    return sql.trim().replace(/;+$/u, '');
}

function paramToString(value: PostgresParamValue): string {
    if (value === null) {
        return '';
    }
    return String(value);
}
