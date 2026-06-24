import { spawn } from 'node:child_process';

import { parseDuration } from '../duration.js';
import { CommandFailedError } from '../errors.js';
import { reservedPortsFromEnv } from '../ports.js';
import { shouldUseProcessGroup, terminateProcessTree } from '../process-tree.js';
import { mergeEnv } from '../shared/env.js';
import { toPathString } from '../shared/path-ref.js';
import type { SmokeEvent, SmokeEventSink } from '../events.js';
import type { CommandOptions, CommandResult, PathRef } from '../types.js';

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

    await emit(input.eventSink, withOptionalStepId(input.stepId, {
        type: 'command.started',
        command: input.command,
        args,
        cwd,
    }));

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
                emit(input.eventSink, withOptionalStepId(input.stepId, {
                    type: 'command.output',
                    stream: 'stdout',
                    text: chunk.toString('utf8'),
                })),
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
                emit(input.eventSink, withOptionalStepId(input.stepId, {
                    type: 'command.output',
                    stream: 'stderr',
                    text: chunk.toString('utf8'),
                })),
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

async function finishCommand(
    input: RunCommandInput,
    outputEvents: Array<Promise<void>>,
    result: CommandResult,
    spawnError: Error | undefined,
    timedOut: boolean,
): Promise<CommandResult> {
    await Promise.all(outputEvents);
    await emit(input.eventSink, withOptionalStepId(input.stepId, {
        type: 'command.finished',
        exitCode: result.exitCode,
        durationMs: result.durationMs,
    }));

    if (spawnError) {
        throw new CommandFailedError(`Command failed to start: ${input.command}`, {
            command: input.command,
            args: result.args,
            cwd: result.cwd,
            ...reservedPortDetails(input.options),
            cause: spawnError.message,
        });
    }

    if (timedOut) {
        throw new CommandFailedError(`Command timed out: ${formatCommand(result)}`, {
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            timeout: input.options?.timeout,
            durationMs: result.durationMs,
            ...reservedPortDetails(input.options),
            stdout: result.stdout,
            stderr: result.stderr,
        });
    }

    if (input.options?.check !== false && result.exitCode !== 0) {
        throw new CommandFailedError(`Command failed with exit code ${String(result.exitCode)}: ${formatCommand(result)}`, {
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            ...reservedPortDetails(input.options),
            stdout: result.stdout,
            stderr: result.stderr,
        });
    }

    return result;
}

function reservedPortDetails(options: CommandOptions | undefined): { reservedPorts?: Record<string, unknown> } {
    const reservedPorts = reservedPortsFromEnv(options?.env);
    return reservedPorts === undefined ? {} : { reservedPorts };
}

function withOptionalStepId(stepId: string | undefined, event: SmokeEvent): SmokeEvent {
    if (!stepId) {
        return event;
    }

    switch (event.type) {
        case 'command.started':
            return { ...event, stepId };
        case 'command.output':
            return { ...event, stepId };
        case 'command.finished':
            return { ...event, stepId };
        case 'artifact.attached':
        case 'log.message':
        case 'run.finished':
        case 'run.started':
        case 'step.failed':
        case 'step.passed':
        case 'step.skipped':
        case 'step.started':
        case 'suite.discovered':
        case 'suite.finished':
        case 'suite.started':
            return event;
    }
}

function formatCommand(result: CommandResult): string {
    return [result.command, ...result.args].join(' ');
}

async function emit(eventSink: SmokeEventSink | undefined, event: SmokeEvent): Promise<void> {
    await eventSink?.emit(event);
}
