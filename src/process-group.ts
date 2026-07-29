import { SmokeError } from './errors.js';
import {
    processGroupError,
    processGroupStopError,
} from './process-group-errors.js';
import { SerializedOperations } from './serialized-operations.js';
import type { ArtifactSink } from './types/artifacts.js';
import type { PathRef } from './types/path-ref.js';
import type {
    ProcessGroup,
    ProcessGroupStartOptions,
    ProcessHandle,
    ProcessStartOptions,
} from './types/process.js';

interface ProcessStarterInput {
    command: string;
    args: string[];
    options?: ProcessStartOptions;
    repoRoot: PathRef;
}

type ProcessStarter = (input: ProcessStarterInput) => Promise<ProcessHandle>;

export function createManagedProcessGroup(
    name: string,
    repoRoot: PathRef,
    startProcess: ProcessStarter,
): ProcessGroup {
    return new ManagedProcessGroup(name, repoRoot, startProcess);
}

class ManagedProcessGroup implements ProcessGroup {
    public readonly kind = 'process-group';
    private readonly handles: Array<{ name: string; handle: ProcessHandle }> = [];
    private readonly lifecycle = new SerializedOperations();
    private stopped = false;

    constructor(
        public readonly name: string,
        private readonly repoRoot: PathRef,
        private readonly startProcess: ProcessStarter,
    ) {}

    public async start(
        name: string,
        command: string,
        args: string[] = [],
        options: ProcessGroupStartOptions = {},
    ): Promise<ProcessHandle> {
        return await this.lifecycle.run(
            async () => await this.startExclusive(name, command, args, options),
        );
    }

    private async startExclusive(
        name: string,
        command: string,
        args: string[],
        options: ProcessGroupStartOptions,
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
            const handle = await this.startProcess({
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
            let stopError: unknown;
            try {
                await this.stopExclusive();
            } catch (errorDuringStop) {
                stopError = errorDuringStop;
            }
            throw processGroupError(error, this.name, name, stopError);
        }
    }

    public get(name: string): ProcessHandle | undefined {
        return this.handles.find((entry) => entry.name === name)?.handle;
    }

    public async stop(signal = 'SIGTERM'): Promise<void> {
        await this.lifecycle.run(async () => {
            await this.stopExclusive(signal);
        });
    }

    private async stopExclusive(signal = 'SIGTERM'): Promise<void> {
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
