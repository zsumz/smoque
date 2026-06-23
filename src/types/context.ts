import type { ArtifactSink } from './artifacts.js';
import type { CommandOptions, CommandResult } from './command.js';
import type { PathRef } from './common.js';
import type { EnvReader } from './env.js';
import type { FileSystemApi, WorkDirOptions } from './filesystem.js';
import type { FixtureApi } from './fixture.js';
import type { LogApi } from './log.js';
import type { NetApi, TcpApi } from './network.js';
import type { PollOptions } from './probe.js';
import type { PortsApi } from './ports.js';
import type { ProcessApi } from './process.js';
import type { SmokeSuite, StepOptions } from './suite.js';
import type { ToolDiscovery } from './tools.js';

export interface SmokeContext {
    readonly suite: SmokeSuite;

    repoRoot(): PathRef;

    step<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
    step<T>(name: string, options: StepOptions, fn: () => Promise<T> | T): Promise<T>;

    cleanup(fn: () => Promise<void> | void): void;
    skip(reason: string): never;
    fail(message: string): never;

    cmd(command: string, args?: string[], options?: CommandOptions): Promise<CommandResult>;
    sh(script: string, options?: CommandOptions): Promise<CommandResult>;

    tempDir(name?: string): Promise<PathRef>;
    workDir(path: string, options?: WorkDirOptions): Promise<PathRef>;

    fixture: FixtureApi;
    fs: FileSystemApi;
    env: EnvReader;
    ports: PortsApi;
    tools: ToolDiscovery;
    net: NetApi;
    tcp: TcpApi;
    process: ProcessApi;
    poll<T>(name: string, fn: () => Promise<T> | T, options?: PollOptions): Promise<T>;

    attach: ArtifactSink;
    redact(value: string | RegExp | undefined | null, options?: RedactOptions): void;
    log: LogApi;
}

export interface RedactOptions {
    replacement?: string;
}
