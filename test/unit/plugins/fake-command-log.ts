import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export interface FakeCommand {
    args: string[];
    cwd: string;
}

export async function readFakeCommandLog(path: string): Promise<FakeCommand[]> {
    const value = await readFile(path, 'utf8');
    return value
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .map(parseFakeCommand);
}

function parseFakeCommand(line: string): FakeCommand {
    const value: unknown = JSON.parse(line);
    assert.ok(typeof value === 'object' && value !== null);
    assert.ok('args' in value && isStringArray(value.args));
    assert.ok('cwd' in value && typeof value.cwd === 'string');
    return { args: value.args, cwd: value.cwd };
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value)
        && value.every((item: unknown) => typeof item === 'string');
}
