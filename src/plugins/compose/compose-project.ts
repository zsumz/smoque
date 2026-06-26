import { isAbsolute, resolve } from 'node:path';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import type {
    ArtifactSink,
    CommandOptions,
    CommandResult,
    DurationString,
    PathRef,
    SmokeContext,
    SmokeResource,
} from '../../types.js';
import { composeCheck, type ComposeCheckOptions } from './compose-check.js';
import {
    ManagedComposeService,
    type ComposeService,
} from './compose-service.js';
import {
    formatCommandHistory,
    formatError,
    wrapComposeError,
    type ComposeCommandRecord,
} from './errors.js';
import {
    parsePublishedPort,
    type ComposePortOptions,
    type ComposePublishedPort,
} from './ports.js';
import { generateProjectName, normalizeProjectName } from './project-name.js';

export interface ComposeUpOptions extends ComposeCheckOptions {
    file?: string | PathRef | Array<string | PathRef>;
    projectName?: string;
    services?: string[];
    removeVolumes?: boolean;
}

export interface ComposeProject extends SmokeResource {
    readonly kind: 'compose.project';
    readonly projectName: string;
    readonly cwd: string;
    readonly files: string[];
    service(name: string): ComposeService;
    logs(options?: ComposeLogsOptions): Promise<string>;
    down(): Promise<void>;
}

export interface ComposeLogsOptions {
    services?: string[];
}

export async function composeUp(
    t: SmokeContext,
    options: ComposeUpOptions = {},
): Promise<ComposeProject> {
    const info = await composeCheck(t, options);
    const project = new ManagedComposeProject(t, info.docker.command, options);

    try {
        await project.up(options.services ?? []);
    } catch (error) {
        await project.attachOnFailure(t.attach);
        await project.cleanup().catch(() => undefined);
        throw wrapComposeError(error, project.projectName);
    }

    return project;
}

class ManagedComposeProject implements ComposeProject {
    public readonly kind = 'compose.project' as const;
    public readonly name: string;
    public readonly projectName: string;
    public readonly cwd: string;
    public readonly files: string[];
    private readonly env: Record<string, string | undefined> | undefined;
    private readonly timeout: DurationString | undefined;
    private readonly removeVolumes: boolean;
    private readonly history: ComposeCommandRecord[] = [];
    private stopped = false;

    constructor(
        private readonly t: SmokeContext,
        private readonly docker: string,
        options: ComposeUpOptions,
    ) {
        this.projectName = normalizeProjectName(options.projectName ?? generateProjectName(t));
        this.name = this.projectName;
        this.cwd = pathToString(options.cwd ?? t.repoRoot());
        this.files = normalizeFiles(options.file, this.cwd);
        this.env = options.env;
        this.timeout = options.timeout;
        this.removeVolumes = options.removeVolumes ?? true;
    }

    public async up(services: string[]): Promise<void> {
        const args = ['up', '--detach', '--remove-orphans', ...services];
        await this.run('up', args);
    }

    public service(name: string): ComposeService {
        return new ManagedComposeService(this.t, this, name);
    }

    public async logs(options: ComposeLogsOptions = {}): Promise<string> {
        const result = await this.run('logs', ['logs', '--no-color', ...options.services ?? []], { check: false });
        return [result.stdout, result.stderr].filter(Boolean).join('\n');
    }

    public async down(): Promise<void> {
        await this.cleanup();
    }

    public async cleanup(): Promise<void> {
        if (this.stopped) {
            return;
        }

        this.stopped = true;
        const args = ['down', '--remove-orphans'];
        if (this.removeVolumes) {
            args.push('--volumes');
        }

        await this.run('down', args);
    }

    public async attachOnFailure(attach: ArtifactSink): Promise<void> {
        const logs = await this.logs().catch((error: unknown) => formatError(error));
        await attach.text(`${this.projectName}-compose-logs.txt`, logs);
        await attach.text(`${this.projectName}-compose-commands.txt`, formatCommandHistory(this.history));
    }

    public async port(service: string, containerPort: number, options: ComposePortOptions = {}): Promise<ComposePublishedPort> {
        const protocol = options.protocol ?? 'tcp';
        const result = await this.run('port', ['port', '--protocol', protocol, service, String(containerPort)]);
        return parsePublishedPort(result.stdout, service, containerPort);
    }

    public async run(label: string, args: string[], options: { check?: boolean } = {}): Promise<CommandResult> {
        const commandArgs = ['compose', '--project-name', this.projectName, ...fileArgs(this.files), ...args];
        const commandOptions: CommandOptions = {
            cwd: this.cwd,
            check: false,
        };
        if (this.env !== undefined) {
            commandOptions.env = this.env;
        }
        if (this.timeout !== undefined) {
            commandOptions.timeout = this.timeout;
        }

        const result = await this.t.cmd(this.docker, commandArgs, commandOptions);
        this.history.push({
            label,
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
        });

        if (options.check !== false && result.exitCode !== 0) {
            throw new SmokeError(`Docker Compose ${label} failed with exit code ${String(result.exitCode)}.`, {
                projectName: this.projectName,
                command: result.command,
                args: result.args,
                cwd: result.cwd,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
            });
        }

        return result;
    }
}

function normalizeFiles(file: ComposeUpOptions['file'], cwd: string): string[] {
    const files = Array.isArray(file) ? file : file === undefined ? [] : [file];
    return files.map((entry) => {
        if (typeof entry !== 'string') {
            return pathToString(entry);
        }
        return isAbsolute(entry) ? entry : resolve(cwd, entry);
    });
}

function fileArgs(files: string[]): string[] {
    return files.flatMap((file) => ['--file', file]);
}
