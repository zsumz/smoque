import { isAbsolute, resolve } from 'node:path';

import { pathToString } from '../../path-ref.js';
import type { ArtifactSink } from '../../types/artifacts.js';
import type { SmokeContext } from '../../types/context.js';
import { composeCheck } from './compose-check.js';
import { ComposeCommandRunner } from './compose-command-runner.js';
import { rethrowComposeStartFailure } from './compose-start-recovery.js';
import type {
    ComposeLogsOptions,
    ComposeProject,
    ComposeUpOptions,
} from './compose-project-types.js';
import {
    ManagedComposeService,
    type ComposeService,
} from './compose-service.js';
import {
    formatCommandHistory,
    formatError,
} from './errors.js';
import {
    parsePublishedPort,
    type ComposePortOptions,
    type ComposePublishedPort,
} from './ports.js';
import { generateProjectName, normalizeProjectName } from './project-name.js';

export type {
    ComposeLogsOptions,
    ComposeProject,
    ComposeUpOptions,
} from './compose-project-types.js';

export async function composeUp(
    t: SmokeContext,
    options: ComposeUpOptions = {},
): Promise<ComposeProject> {
    const info = await composeCheck(t, options);
    const project = new ManagedComposeProject(t, info.docker.command, options);

    try {
        await project.up(options.services ?? []);
    } catch (error) {
        await rethrowComposeStartFailure(error, project, t.attach);
    }

    return project;
}

class ManagedComposeProject implements ComposeProject {
    public readonly kind = 'compose.project' as const;
    public readonly name: string;
    public readonly projectName: string;
    public readonly cwd: string;
    public readonly files: string[];
    private readonly removeVolumes: boolean;
    private readonly commands: ComposeCommandRunner;
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
        this.removeVolumes = options.removeVolumes ?? true;
        this.commands = new ComposeCommandRunner(
            t,
            docker,
            this.projectName,
            this.cwd,
            this.files,
            options.env,
            options.timeout,
        );
    }

    public async up(services: string[]): Promise<void> {
        const args = ['up', '--detach', '--remove-orphans', ...services];
        await this.commands.run('up', args);
    }

    public service(name: string): ComposeService {
        return new ManagedComposeService(this.t, this, name);
    }

    public async logs(options: ComposeLogsOptions = {}): Promise<string> {
        const result = await this.commands.run(
            'logs',
            ['logs', '--no-color', ...options.services ?? []],
            { check: false },
        );
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

        await this.commands.run('down', args);
    }

    public async attachOnFailure(attach: ArtifactSink): Promise<void> {
        const logs = await this.logs().catch((error: unknown) => formatError(error));
        await attach.text(`${this.projectName}-compose-logs.txt`, logs);
        await attach.text(
            `${this.projectName}-compose-commands.txt`,
            formatCommandHistory(this.commands.history),
        );
    }

    public async port(service: string, containerPort: number, options: ComposePortOptions = {}): Promise<ComposePublishedPort> {
        const protocol = options.protocol ?? 'tcp';
        const result = await this.commands.run(
            'port',
            ['port', '--protocol', protocol, service, String(containerPort)],
        );
        return parsePublishedPort(result.stdout, service, containerPort);
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
