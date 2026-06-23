import type { CommandResult } from './command.js';
import type { ChecksumAlgorithm, DurationString, PathRef } from './common.js';

export interface ExecutableOptions {
    args?: string[];
    cwd?: string | PathRef;
    env?: Record<string, string | undefined>;
    timeout?: DurationString;
    expectedExitCode?: number;
}

export interface FileSetExpectation {
    matching(pattern: string | string[]): FileSetExpectation;
    toContainAny(patterns: Array<string | RegExp>): Promise<void>;
    not: {
        toContainAny(patterns: Array<string | RegExp>): Promise<void>;
        toContainForbidden(rules?: ForbiddenRule | ForbiddenRule[]): Promise<void>;
    };
}

export interface ForbiddenRule {
    name: string;
    pattern: string | RegExp;
    scope?: 'content' | 'path' | 'both';
}

export interface FileExpectation {
    toExist(): Promise<void>;
    not: {
        toExist(): Promise<void>;
    };
    text(): Promise<string>;
    toContain(value: string | RegExp): Promise<void>;
    toMatch(value: RegExp): Promise<void>;
    jsonPath(path: string): JsonPathExpectation;
    toBeExecutable(options?: ExecutableOptions): Promise<void>;
    toHaveChecksum(algorithm: ChecksumAlgorithm, expected: string): Promise<void>;
}

export interface JsonPathExpectation {
    toBe(expected: unknown): Promise<void>;
    toEqual(expected: unknown): Promise<void>;
    toContain(expected: unknown): Promise<void>;
}

export interface CommandExpectation {
    stdout(): ValueExpectation<string>;
    stderr(): ValueExpectation<string>;
    jsonPath(path: string): JsonPathExpectation;
    toExitWith(code: number): void;
}

export interface TextSnapshotExpectation {
    toMatchSnapshot(path: string | PathRef): Promise<void>;
}

export interface DirectorySnapshotOptions {
    checksum?: ChecksumAlgorithm | boolean;
}

export interface DirectorySnapshotExpectation {
    toMatchSnapshot(path: string | PathRef, options?: DirectorySnapshotOptions): Promise<void>;
}

export interface ArchiveExpectation {
    toContain(path: string): Promise<void>;
    not: {
        toContain(path: string): Promise<void>;
    };
}

export interface ValueExpectation<T> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toContain(expected: T extends string ? string : unknown): void;
    toMatch(expected: RegExp): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
}

export interface SmokeExpectApi {
    value<T>(value: T): ValueExpectation<T>;
    command(result: CommandResult): CommandExpectation;
    file(path: string | PathRef): FileExpectation;
    files(root: string | PathRef): FileSetExpectation;
    text(value: string): TextSnapshotExpectation;
    directory(root: string | PathRef): DirectorySnapshotExpectation;
    archive(path: string | PathRef): ArchiveExpectation;
}
