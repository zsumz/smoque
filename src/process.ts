import { spawn } from 'node:child_process';

import { pathToString } from './path-ref.js';
import { createManagedProcessGroup } from './process-group.js';
import { ManagedProcessHandle } from './process-handle.js';
import {
    waitForProcessReady,
    waitForProcessSpawn,
} from './process-readiness.js';
import { shouldUseProcessGroup } from './process-tree.js';
import { mergeEnv } from './shared/env.js';
import type { PathRef } from './types/path-ref.js';
import type { ProcessGroup, ProcessHandle, ProcessStartOptions } from './types/process.js';

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
        await waitForProcessSpawn(child, input.command, options);
        if (options.ready) {
            await waitForProcessReady(options, handle);
        }
    } catch (error) {
        await handle.stop();
        throw error;
    }

    return handle;
}

export function createProcessGroup(input: CreateProcessGroupInput): ProcessGroup {
    return createManagedProcessGroup(input.name, input.repoRoot, startProcess);
}
