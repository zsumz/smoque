import { SmokeError } from '../../errors.js';
import { createFixtureApi } from '../../fixture.js';
import { createFileSystemApi, createTempDir, createWorkDir } from '../../filesystem.js';
import { createLogApi } from '../../log.js';
import { createNetApi } from '../../network.js';
import { poll } from '../../poll.js';
import { createPortsApi } from '../../ports.js';
import { createProcessGroup, startProcess } from '../../process.js';
import { createTcpApi } from '../../tcp.js';
import { createToolDiscovery } from '../../tools.js';
import type { SmokeEvent } from '../../events.js';
import type {
    CommandOptions,
    CommandResult,
    PathRef,
    ProcessStartOptions,
    RedactOptions,
    SmokeContext,
    SmokeResource,
    SmokeSuite,
    StepOptions,
    WorkDirOptions,
} from '../../types.js';
import type { ExtensionBucket } from '../plugin-registry.js';
import { createArtifactSink } from './artifact-sink.js';
import { createEnvReader } from './env-reader.js';
import { SmokeSkipSignal } from './skip-signal.js';

export interface SmokeContextHost {
    suite: SmokeSuite;
    root: PathRef;
    extensions: ExtensionBucket;
    keepWorkdirOnFail: boolean;
    preserveManagedWorkdirs(): boolean;
    currentStepId(): string | undefined;
    runStep<T>(name: string, options: StepOptions, fn: () => Promise<T> | T): Promise<T>;
    runCommand(command: string, args: string[], options: CommandOptions): Promise<CommandResult>;
    addCleanup(fn: () => Promise<void> | void): void;
    addResource(resource: SmokeResource): void;
    addManagedResource(resource: SmokeResource): void;
    addRedaction(value: string | RegExp | undefined | null, options?: RedactOptions): void;
    redactText(value: string): string;
    emit(event: SmokeEvent): Promise<void>;
}

export function createSmokeContext(host: SmokeContextHost): SmokeContext {
    const context = {
        suite: host.suite,
        repoRoot: () => host.root,
        step: (async <T>(
            name: string,
            optionsOrFn: StepOptions | (() => Promise<T> | T),
            maybeFn?: () => Promise<T> | T,
        ) => {
            const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn;
            const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;

            if (!fn) {
                throw new SmokeError(`Smoke step "${name}" is missing a callback.`);
            }

            return host.runStep(name, options, fn);
        }) as SmokeContext['step'],
        cleanup: (fn: () => Promise<void> | void) => {
            host.addCleanup(fn);
        },
        skip: (reason: string) => {
            throw new SmokeSkipSignal(reason);
        },
        fail: (message: string) => {
            throw new SmokeError(message);
        },
        cmd: async (command: string, args: string[] = [], options: CommandOptions = {}) =>
            host.runCommand(command, args, options),
        sh: async (script: string, options: CommandOptions = {}) => host.runCommand(script, [], { ...options, shell: true }),
        tempDir: async (name?: string) => {
            const dir = await createTempDir(name);
            host.addCleanup(async () => {
                if (host.keepWorkdirOnFail && host.preserveManagedWorkdirs()) {
                    return;
                }
                await createFileSystemApi(host.root).rm(dir, { recursive: true, force: true });
            });
            return dir;
        },
        workDir: async (path: string, options: WorkDirOptions = {}) => {
            const dir = await createWorkDir(host.root, path, options);
            host.addCleanup(async () => {
                if ((host.keepWorkdirOnFail || options.keepOnFail) && host.preserveManagedWorkdirs()) {
                    return;
                }
                await createFileSystemApi(host.root).rm(dir, {
                    recursive: true,
                    force: true,
                    refuse: [host.root, ...options.refuse ?? []],
                });
            });
            return dir;
        },
        fixture: undefined,
        fs: createFileSystemApi(host.root),
        env: createEnvReader((value) => {
            host.addRedaction(value);
        }),
        ports: createPortsApi((fn) => {
            host.addCleanup(fn);
        }),
        tools: createToolDiscovery(),
        net: undefined,
        tcp: createTcpApi(),
        process: {
            start: async (command: string, args: string[] = [], options: ProcessStartOptions = {}) => {
                const handle = await startProcess({
                    command,
                    args,
                    options,
                    repoRoot: host.root,
                });
                host.addManagedResource(handle);
                return handle;
            },
            group: (name = 'process-group') => {
                const group = createProcessGroup({
                    name,
                    repoRoot: host.root,
                });
                host.addManagedResource(group);
                return group;
            },
        },
        poll,
        attach: createArtifactSink({
            suiteId: host.suite.id,
            currentStepId: () => host.currentStepId(),
            emit: async (event) => host.emit(event),
            redactText: (value) => host.redactText(value),
        }),
        redact: (value: string | RegExp | undefined | null, options?: RedactOptions) => {
            host.addRedaction(value, options);
        },
        log: createLogApi(async (message) => {
            const event: SmokeEvent = {
                type: 'log.message',
                suiteId: host.suite.id,
                message,
            };
            const stepId = host.currentStepId();
            if (stepId !== undefined) {
                Object.assign(event, { stepId });
            }
            return host.emit(event);
        }),
    } as unknown as SmokeContext;
    context.net = createNetApi(context);
    context.fixture = createFixtureApi(context);

    applyPluginExtensions(context, host);
    return context;
}

function applyPluginExtensions(context: SmokeContext, host: SmokeContextHost): void {
    for (const [name, factory] of host.extensions.actions) {
        assignDotted(context, name, async (...args: unknown[]) => {
            const value = await factory(context, ...args);
            if (isSmokeResource(value)) {
                host.addManagedResource(value);
            }
            return value;
        });
    }
    for (const [name, factory] of host.extensions.probes) {
        assignDotted(context, name, (...args: unknown[]) => factory(context, args.length <= 1 ? args[0] : args));
    }
    for (const [name, factory] of host.extensions.resources) {
        assignDotted(context, name, async (...args: unknown[]) => {
            const resource = await factory(context, args.length <= 1 ? args[0] : args);
            if (isSmokeResource(resource)) {
                host.addManagedResource(resource);
            }
            return resource;
        });
    }
    for (const [name, factory] of host.extensions.recipes) {
        assignDotted(context, name, (options: unknown) => factory(context, options));
    }
}

function assignDotted(target: object, dottedName: string, value: unknown): void {
    const parts = dottedName.split('.').filter(Boolean);
    if (parts.length === 0) {
        throw new SmokeError(`Invalid plugin extension name: ${dottedName}`);
    }

    let cursor = target as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) {
        const existing = cursor[part];
        if (existing === undefined) {
            const next: Record<string, unknown> = {};
            cursor[part] = next;
            cursor = next;
            continue;
        }

        if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
            throw new SmokeError(`Plugin extension name conflicts with existing context property: ${dottedName}`);
        }

        cursor = existing as Record<string, unknown>;
    }

    const leaf = parts[parts.length - 1];
    if (!leaf) {
        throw new SmokeError(`Invalid plugin extension name: ${dottedName}`);
    }
    if (cursor[leaf] !== undefined) {
        throw new SmokeError(`Duplicate plugin context extension: ${dottedName}`);
    }

    cursor[leaf] = value;
}

function isSmokeResource(value: unknown): value is SmokeResource {
    return typeof value === 'object' && value !== null && 'cleanup' in value;
}
