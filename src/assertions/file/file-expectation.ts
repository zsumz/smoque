import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';

import { parseDuration } from '../../duration.js';
import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import { mergeEnv } from '../../shared/env.js';
import { isNotFoundError } from '../../shared/fs.js';
import type { ChecksumAlgorithm, ExecutableOptions, PathRef } from '../../types.js';
import { createJsonPathExpectation, parseStructuredJson } from '../json-path-expectation.js';
import type { FileExpectation, JsonPathExpectation } from '../types.js';

export function createFileExpectation(path: string | PathRef): FileExpectation {
    const target = pathToString(path);

    return {
        async toExist(): Promise<void> {
            if (!await exists(target)) {
                throw new SmokeError(`Expected file to exist: ${target}`, { path: target });
            }
        },
        async notToExist(): Promise<void> {
            if (await exists(target)) {
                throw new SmokeError(`Expected file not to exist: ${target}`, { path: target });
            }
        },
        async toContain(expected): Promise<void> {
            const content = await readExistingFile(target);
            if (!matches(content, expected)) {
                throw new SmokeError(`Expected file to contain ${formatPattern(expected)}: ${target}`, {
                    path: target,
                    expected: formatPattern(expected),
                });
            }
        },
        async notToContain(expected): Promise<void> {
            const content = await readExistingFile(target);
            if (matches(content, expected)) {
                throw new SmokeError(`Expected file not to contain ${formatPattern(expected)}: ${target}`, {
                    path: target,
                    expected: formatPattern(expected),
                });
            }
        },
        async toBeExecutable(options: ExecutableOptions = {}): Promise<void> {
            const executableStat = await readExecutableStat(target);
            const permissions = formatPermissions(executableStat.mode);

            if (!executableStat.isFile()) {
                throw new SmokeError(`Expected executable path to be a file: ${target}`, {
                    path: target,
                    platform: process.platform,
                    permissions,
                });
            }

            if (process.platform !== 'win32' && (executableStat.mode & 0o111) === 0) {
                throw new SmokeError(`Expected file to be executable: ${target}`, {
                    path: target,
                    platform: process.platform,
                    permissions,
                });
            }

            if (options.args !== undefined) {
                const result = await runExecutable(target, options);
                const expectedExitCode = options.expectedExitCode ?? 0;
                if (result.exitCode !== expectedExitCode) {
                    throw new SmokeError(`Expected executable to exit ${String(expectedExitCode)}: ${target}`, {
                        path: target,
                        platform: process.platform,
                        permissions,
                        command: target,
                        args: options.args,
                        cwd: options.cwd === undefined ? undefined : pathToString(options.cwd),
                        exitCode: result.exitCode,
                        expectedExitCode,
                        stdout: result.stdout,
                        stderr: result.stderr,
                    });
                }
            }
        },
        async toHaveChecksum(algorithm: ChecksumAlgorithm, expected: string): Promise<void> {
            const content = await readFile(target);
            const actual = createHash(algorithm).update(content).digest('hex');

            if (actual.toLowerCase() !== expected.toLowerCase()) {
                throw new SmokeError(`Expected ${algorithm} checksum to match: ${target}`, {
                    path: target,
                    algorithm,
                    expected,
                    actual,
                });
            }
        },
        jsonPath(path): JsonPathExpectation {
            return createJsonPathExpectation(async () => {
                const text = await readExistingFile(target);
                return parseStructuredJson(text, {
                    source: 'file',
                    path: target,
                });
            }, path, {
                source: 'file',
                path: target,
            });
        },
    };
}

async function readExistingFile(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        if (isNotFoundError(error)) {
            throw new SmokeError(`Expected file to exist: ${path}`, { path });
        }
        throw error;
    }
}

async function readExecutableStat(path: string): Promise<Stats> {
    try {
        return await stat(path);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw new SmokeError(`Expected executable file to exist: ${path}`, { path, platform: process.platform });
        }
        throw error;
    }
}

async function runExecutable(
    path: string,
    options: ExecutableOptions,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolveRun) => {
        const timeoutMs = parseDuration(options.timeout, 5_000);
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let settled = false;
        let timedOut = false;

        const child = spawn(path, options.args ?? [], {
            cwd: options.cwd === undefined ? undefined : pathToString(options.cwd),
            env: mergeEnv(options.env),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });

        const finish = (exitCode: number): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolveRun({
                exitCode,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: Buffer.concat(stderr).toString('utf8'),
            });
        };

        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        child.on('error', (error) => {
            stderr.push(Buffer.from(error.message));
            finish(1);
        });
        child.on('close', (exitCode) => {
            finish(timedOut ? -1 : exitCode ?? 0);
        });
    });
}

function formatPermissions(mode: number): string {
    return `0${(mode & 0o777).toString(8)}`;
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

function matches(content: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
        return content.includes(pattern);
    }

    pattern.lastIndex = 0;
    return pattern.test(content);
}

function formatPattern(pattern: string | RegExp): string {
    return typeof pattern === 'string' ? JSON.stringify(pattern) : String(pattern);
}
