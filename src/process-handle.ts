import type { ChildProcess } from 'node:child_process';

import {
    forceKillProcessTreeAfter,
    terminateProcessTree,
} from './process-tree.js';
import type { ArtifactSink, ProcessHandle } from './types.js';

export class ManagedProcessHandle implements ProcessHandle {
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
        await Promise.race([
            this.closePromise,
            forceKillProcessTreeAfter(this.child, 500),
        ]);
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
