import { SmokeError } from './errors.js';
import type {
    ArtifactSink,
    PathRef,
    ProcessGroup,
    ProcessGroupStartOptions,
    ProcessHandle,
    ProcessStartOptions,
} from './types.js';

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

function processGroupError(
    error: unknown,
    processGroup: string,
    processName: string,
): SmokeError {
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
