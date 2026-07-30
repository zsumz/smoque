import { spawn } from 'node:child_process';

import {
    scheduleProcessTreeTimeout,
    shouldUseProcessGroup,
} from '../process-tree.js';

export interface ProcessResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut?: boolean;
}

export interface RunProcessOptions {
    timeoutMs?: number;
    timeoutLabel?: string;
}

export async function runProcess(
    command: string,
    args: string[],
    cwd?: string,
    options: RunProcessOptions = {},
): Promise<ProcessResult> {
    return new Promise((resolveProcess) => {
        const child = spawn(command, args, {
            cwd,
            detached: shouldUseProcessGroup(),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let resolved = false;
        const processTimeout = options.timeoutMs === undefined
            ? undefined
            : scheduleProcessTreeTimeout(child, options.timeoutMs);

        const finish = (result: ProcessResult): void => {
            if (resolved) {
                return;
            }
            resolved = true;
            processTimeout?.cancel();
            resolveProcess(result);
        };

        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        child.on('error', (error) => {
            finish({ exitCode: 1, stdout: '', stderr: error.message });
        });
        child.on('close', (exitCode) => {
            const stderrText = Buffer.concat(stderr).toString('utf8');
            const timedOut = processTimeout?.didExpire() ?? false;
            finish({
                exitCode,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: timedOut
                    ? [stderrText.trimEnd(), `Timed out after ${timeoutMessage(options)}.`]
                        .filter(Boolean)
                        .join('\n')
                    : stderrText,
                timedOut,
            });
        });
    });
}

function timeoutMessage(options: RunProcessOptions): string {
    return options.timeoutLabel ?? `${String(options.timeoutMs)}ms`;
}
