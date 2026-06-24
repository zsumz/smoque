import { spawn, type ChildProcess } from 'node:child_process';

import { parseDuration } from './duration.js';
import { ProbeTimeoutError, SmokeError } from './errors.js';
import { pathToString } from './path-ref.js';
import { reservedPortsFromEnv } from './ports.js';
import { forceKillProcessTreeAfter, shouldUseProcessGroup, terminateProcessTree } from './process-tree.js';
import { mergeEnv } from './shared/env.js';
import type { ArtifactSink, PathRef, ProcessGroup, ProcessGroupStartOptions, ProcessHandle, ProcessStartOptions } from './types.js';

export interface StartProcessInput {
    command: string;
    args: string[];
    options?: ProcessStartOptions;
    repoRoot: PathRef;
}

export interface CreateProcessGroupInput {
    name: string;
    repoRoot: PathRef;
}

export async function startProcess(input: StartProcessInput): Promise<ProcessHandle> {
    const options = input.options ?? {};
    const args = [...input.args];
    const cwd = pathToString(options.cwd ?? input.repoRoot);
    const stdoutMode = options.stdout ?? 'capture';
    const stderrMode = options.stderr ?? 'capture';
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let exited = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;

    const child = spawn(input.command, args, {
        cwd,
        env: mergeEnv(options.env),
        detached: shouldUseProcessGroup(),
        shell: options.shell ?? false,
        stdio: ['pipe', stdoutMode === 'ignore' ? 'ignore' : 'pipe', stderrMode === 'ignore' ? 'ignore' : 'pipe'],
        windowsHide: true,
    });

    child.stdout?.on('data', (chunk: Buffer) => {
        if (stdoutMode === 'capture' || stdoutMode === 'inherit') {
            stdoutChunks.push(chunk);
        }
        if (stdoutMode === 'inherit') {
            process.stdout.write(chunk);
        }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
        if (stderrMode === 'capture' || stderrMode === 'inherit') {
            stderrChunks.push(chunk);
        }
        if (stderrMode === 'inherit') {
            process.stderr.write(chunk);
        }
    });

    const closePromise: Promise<void> = new Promise((resolve) => {
        child.on('close', (code, signal) => {
            exited = true;
            exitCode = code;
            exitSignal = signal;
            resolve();
        });
    });

    const handle = new ManagedProcessHandle(
        options.name ?? input.command,
        child,
        closePromise,
        () => exited,
        () => exitCode,
        () => exitSignal,
        () => Buffer.concat(stdoutChunks).toString('utf8'),
        () => Buffer.concat(stderrChunks).toString('utf8'),
    );

    try {
        await waitForSpawn(child, input.command, options);
        if (options.ready) {
            await waitForReady(options, handle);
        }
    } catch (error) {
        await handle.stop();
        throw error;
    }

    return handle;
}

export function createProcessGroup(input: CreateProcessGroupInput): ProcessGroup {
    return new ManagedProcessGroup(input.name, input.repoRoot);
}

class ManagedProcessHandle implements ProcessHandle {
    public readonly kind = 'process';
    private stopped = false;

    constructor(
        public readonly name: string,
        private readonly child: ChildProcess,
        private readonly closePromise: Promise<void>,
        private readonly isExited: () => boolean,
        private readonly getExitCode: () => number | null,
        private readonly getExitSignal: () => NodeJS.Signals | null,
        private readonly getStdout: () => string,
        private readonly getStderr: () => string,
    ) {}

    public get pid(): number | undefined {
        return this.child.pid;
    }

    public stdout(): string {
        return this.getStdout();
    }

    public stderr(): string {
        return this.getStderr();
    }

    public async stop(signal = 'SIGTERM'): Promise<void> {
        if (this.stopped) {
            return;
        }

        this.stopped = true;

        if (this.isExited()) {
            return;
        }

        terminateProcessTree(this.child, signal as NodeJS.Signals);
        await Promise.race([this.closePromise, forceKillProcessTreeAfter(this.child, 500)]);
        await this.closePromise;
    }

    public async cleanup(): Promise<void> {
        await this.stop();
    }

    public async attachOnFailure(attach: ArtifactSink): Promise<void> {
        await attach.text(`${this.name}-stdout.log`, this.getStdout());
        await attach.text(`${this.name}-stderr.log`, this.getStderr());
    }

    public exitDetails(): Record<string, unknown> {
        return {
            pid: this.pid,
            exitCode: this.getExitCode(),
            signal: this.getExitSignal(),
            stdout: this.getStdout(),
            stderr: this.getStderr(),
        };
    }
}

class ManagedProcessGroup implements ProcessGroup {
    public readonly kind = 'process-group';
    private readonly handles: Array<{ name: string; handle: ProcessHandle }> = [];
    private stopped = false;

    constructor(
        public readonly name: string,
        private readonly repoRoot: PathRef,
    ) {}

    public async start(
        name: string,
        command: string,
        args: string[] = [],
        options: ProcessGroupStartOptions = {},
    ): Promise<ProcessHandle> {
        if (this.stopped) {
            throw new SmokeError(`Process group is already stopped: ${this.name}`, {
                processGroup: this.name,
                processName: name,
            });
        }

        if (this.handles.some((entry) => entry.name === name)) {
            throw new SmokeError(`Process group already has a process named: ${name}`, {
                processGroup: this.name,
                processName: name,
            });
        }

        try {
            const handle = await startProcess({
                command,
                args,
                options: {
                    ...options,
                    name: `${this.name}-${name}`,
                },
                repoRoot: this.repoRoot,
            });

            this.handles.push({ name, handle });
            return handle;
        } catch (error) {
            await this.stop();
            throw processGroupError(error, this.name, name);
        }
    }

    public get(name: string): ProcessHandle | undefined {
        return this.handles.find((entry) => entry.name === name)?.handle;
    }

    public async stop(signal = 'SIGTERM'): Promise<void> {
        if (this.stopped) {
            return;
        }

        this.stopped = true;
        const errors: unknown[] = [];

        for (const { handle } of [...this.handles].reverse()) {
            try {
                await handle.stop(signal);
            } catch (error) {
                errors.push(error);
            }
        }

        if (errors.length > 0) {
            throw processGroupStopError(errors, this.name);
        }
    }

    public async cleanup(): Promise<void> {
        await this.stop();
    }

    public async attachOnFailure(attach: ArtifactSink): Promise<void> {
        for (const { handle } of this.handles) {
            await handle.attachOnFailure?.(attach);
        }
    }
}

async function waitForReady(options: ProcessStartOptions, handle: ManagedProcessHandle): Promise<void> {
    const timeoutMs = parseDuration(options.timeout, 30_000);
    const intervalMs = 100;
    const startedAt = Date.now();
    let attempts = 0;
    let lastMessage: string | undefined;

    while (Date.now() - startedAt <= timeoutMs) {
        attempts += 1;

        if (handle.exitDetails().exitCode !== null || handle.exitDetails().signal !== null) {
            throw new SmokeError('Process exited before it became ready.', {
                ready: options.ready?.description,
                ...reservedPortDetails(options),
                ...handle.exitDetails(),
            });
        }

        const result = await options.ready?.check(handle);
        if (result?.ready) {
            return;
        }

        lastMessage = result?.message;
        const remainingMs = timeoutMs - (Date.now() - startedAt);
        if (remainingMs <= 0) {
            break;
        }
        await sleep(Math.min(intervalMs, remainingMs));
    }

    throw new ProbeTimeoutError(`Timed out waiting for process readiness after ${String(timeoutMs)}ms.`, {
        probe: options.ready?.description,
        timeoutMs,
        attempts,
        lastMessage,
        ...reservedPortDetails(options),
        ...handle.exitDetails(),
    });
}

function processGroupError(error: unknown, processGroup: string, processName: string): SmokeError {
    const details = error instanceof SmokeError ? error.details : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new SmokeError(
        `Process group "${processGroup}" failed starting "${processName}": ${message}`,
        {
            ...details ?? {},
            processGroup,
            processName,
        },
    );

    if (error instanceof Error) {
        wrapped.name = error.name;
    }

    return wrapped;
}

function processGroupStopError(errors: unknown[], processGroup: string): SmokeError {
    return new SmokeError(`Process group "${processGroup}" failed during cleanup.`, {
        processGroup,
        errors: errors.map((error) => error instanceof Error ? error.message : String(error)),
    });
}

async function waitForSpawn(child: ChildProcess, command: string, options: ProcessStartOptions): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', (error) => {
            reject(new SmokeError(`Process failed to start: ${command}`, {
                ...reservedPortDetails(options),
                cause: error.message,
            }));
        });
    });
}

function reservedPortDetails(options: ProcessStartOptions | undefined): { reservedPorts?: Record<string, unknown> } {
    const reservedPorts = reservedPortsFromEnv(options?.env);
    return reservedPorts === undefined ? {} : { reservedPorts };
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
