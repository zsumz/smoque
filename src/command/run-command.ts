import { spawn } from 'node:child_process';

import { parseDuration } from '../duration.js';
import { shouldUseProcessGroup, terminateProcessTree } from '../process-tree.js';
import { mergeEnv } from '../shared/env.js';
import { toPathString } from '../shared/path-ref.js';
import type { SmokeEventSink } from '../events.js';
import type { CommandOptions, CommandResult, PathRef } from '../types.js';
import { finishCommand } from './command-completion.js';
import { emitCommandOutput, emitCommandStarted } from './command-events.js';

export interface RunCommandInput {
    command: string;
    args: string[];
    options?: CommandOptions;
    repoRoot: PathRef;
    stepId?: string;
    eventSink?: SmokeEventSink;
}

export async function runCommand(input: RunCommandInput): Promise<CommandResult> {
    const options = input.options ?? {};
    const args = [...input.args];
    const cwd = toPathString(options.cwd ?? input.repoRoot);
    const startedAt = Date.now();
    const stdoutMode = options.stdout ?? 'capture';
    const stderrMode = options.stderr ?? 'capture';
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const outputEvents: Array<Promise<void>> = [];

    await emitCommandStarted(input.eventSink, input.stepId, input.command, args, cwd);

    return await new Promise<CommandResult>((resolve, reject) => {
        const child = spawn(input.command, args, {
            cwd,
            env: mergeEnv(options.env),
            detached: shouldUseProcessGroup(),
            shell: options.shell ?? false,
            stdio: ['pipe', stdoutMode === 'ignore' ? 'ignore' : 'pipe', stderrMode === 'ignore' ? 'ignore' : 'pipe'],
            windowsHide: true,
        });

        let spawnError: Error | undefined;
        let timedOut = false;
        let timeout: NodeJS.Timeout | undefined;
        let forceKillTimeout: NodeJS.Timeout | undefined;

        const timeoutMs = options.timeout ? parseDuration(options.timeout, 0) : undefined;
        if (timeoutMs !== undefined) {
            timeout = setTimeout(() => {
                timedOut = true;
                terminateProcessTree(child, 'SIGTERM');
                forceKillTimeout = setTimeout(() => {
                    terminateProcessTree(child, 'SIGKILL');
                }, 500);
            }, timeoutMs);
        }

        if (options.stdin !== undefined && child.stdin) {
            child.stdin.end(options.stdin);
        } else {
            child.stdin?.end();
        }

        child.stdout?.on('data', (chunk: Buffer) => {
            if (stdoutMode === 'capture' || stdoutMode === 'inherit') {
                stdoutChunks.push(chunk);
            }
            if (stdoutMode === 'inherit') {
                process.stdout.write(chunk);
            }
            outputEvents.push(
                emitCommandOutput(
                    input.eventSink,
                    input.stepId,
                    'stdout',
                    chunk.toString('utf8'),
                ),
            );
        });

        child.stderr?.on('data', (chunk: Buffer) => {
            if (stderrMode === 'capture' || stderrMode === 'inherit') {
                stderrChunks.push(chunk);
            }
            if (stderrMode === 'inherit') {
                process.stderr.write(chunk);
            }
            outputEvents.push(
                emitCommandOutput(
                    input.eventSink,
                    input.stepId,
                    'stderr',
                    chunk.toString('utf8'),
                ),
            );
        });

        child.on('error', (error) => {
            spawnError = error;
        });

        child.on('close', (exitCode, signal) => {
            const durationMs = Date.now() - startedAt;
            const normalizedExitCode = exitCode ?? (signal ? -1 : 0);
            const result: CommandResult = {
                command: input.command,
                args,
                cwd,
                exitCode: normalizedExitCode,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
                durationMs,
            };

            if (timeout) {
                clearTimeout(timeout);
            }
            if (forceKillTimeout) {
                clearTimeout(forceKillTimeout);
            }

            void finishCommand(input, outputEvents, result, spawnError, timedOut).then(resolve, reject);
        });
    });
}
