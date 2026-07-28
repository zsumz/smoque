import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ChildProcess } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const cliPath = resolve(repoRoot, 'dist', 'cli', 'main.js');
const defaultCliTimeoutMs = 10_000;
const forceKillDelayMs = 500;

export interface CliResult {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}

export const coreUrl = pathToFileURL(resolve(repoRoot, 'dist', 'core.js')).href;

export async function runCli(
    args: readonly string[],
    cwd: string,
    timeoutMs = defaultCliTimeoutMs,
): Promise<CliResult> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(process.execPath, [cliPath, ...args], {
            cwd,
            detached: process.platform !== 'win32',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let forceKillTimer: NodeJS.Timeout | undefined;
        let settled = false;
        let timedOut = false;
        const cleanup = (): void => {
            clearTimeout(timeoutTimer);
            if (forceKillTimer !== undefined) {
                clearTimeout(forceKillTimer);
            }
        };
        const timeoutTimer = setTimeout(() => {
            timedOut = true;
            terminateCliProcess(child, 'SIGTERM');
            forceKillTimer = setTimeout(() => {
                terminateCliProcess(child, 'SIGKILL');
            }, forceKillDelayMs);
            forceKillTimer.unref();
        }, timeoutMs);
        timeoutTimer.unref();

        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        child.on('error', (error) => {
            if (!settled) {
                settled = true;
                cleanup();
                reject(error);
            }
        });
        child.on('close', (exitCode, signal) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            const result: CliResult = {
                exitCode,
                signal,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: Buffer.concat(stderr).toString('utf8'),
            };

            if (timedOut) {
                reject(new Error([
                    `CLI command timed out after ${String(timeoutMs)}ms: ${formatCliCommand(args)}`,
                    `cwd: ${cwd}`,
                    cliResultSummary(result),
                ].join('\n\n')));
                return;
            }
            resolvePromise(result);
        });
    });
}

export function cliResultSummary(result: CliResult, context?: string): string {
    return [
        context === undefined ? undefined : `context: ${context}`,
        `exitCode: ${result.exitCode === null ? '<none>' : String(result.exitCode)}`,
        `signal: ${result.signal ?? '<none>'}`,
        result.stdout ? `stdout:\n${result.stdout}` : 'stdout: <empty>',
        result.stderr ? `stderr:\n${result.stderr}` : 'stderr: <empty>',
    ].filter(Boolean).join('\n\n');
}

function terminateCliProcess(child: ChildProcess, signal: NodeJS.Signals): void {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    if (process.platform !== 'win32' && child.pid !== undefined) {
        try {
            process.kill(-child.pid, signal);
            return;
        } catch (error) {
            if (isErrnoException(error) && error.code === 'ESRCH') {
                return;
            }
        }
    }
    child.kill(signal);
}

function formatCliCommand(args: readonly string[]): string {
    return ['smoque', ...args].map((arg) => JSON.stringify(arg)).join(' ');
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}
