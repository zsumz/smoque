import type {
    ChecksumAlgorithm,
    CommandResult,
    ExecutableOptions,
    FileSetExpectation,
    PathRef,
} from '../types.js';

export interface SmokeExpectApi {
    <T>(value: T): ValueExpectation<T>;
    value<T>(value: T): ValueExpectation<T>;
    command(result: CommandResult): CommandExpectation;
    file(path: string | PathRef): FileExpectation;
    files(root: string | PathRef): FileSetExpectation;
    archive(path: string | PathRef): ArchiveExpectation;
    text(value: string): TextSnapshotExpectation;
    directory(root: string | PathRef): DirectorySnapshotExpectation;
}

export interface ValueExpectation<T> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toMatch(pattern: RegExp): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
}

export interface FileExpectation {
    toExist(): Promise<void>;
    notToExist(): Promise<void>;
    toContain(expected: string | RegExp): Promise<void>;
    notToContain(expected: string | RegExp): Promise<void>;
    toBeExecutable(options?: ExecutableOptions): Promise<void>;
    toHaveChecksum(algorithm: ChecksumAlgorithm, expected: string): Promise<void>;
    jsonPath(path: string): JsonPathExpectation;
}

export interface CommandExpectation {
    stdoutJsonPath(path: string): JsonPathExpectation;
    stderrJsonPath(path: string): JsonPathExpectation;
}

export interface JsonPathExpectation {
    toBe(expected: unknown): Promise<void>;
    toEqual(expected: unknown): Promise<void>;
    toExist(): Promise<void>;
}

export interface ArchiveExpectation {
    toContainEntries(entries: string[]): Promise<void>;
    not: {
        toContainEntries(entries: string[]): Promise<void>;
    };
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
