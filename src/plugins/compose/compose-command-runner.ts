import { SmokeError } from '../../errors.js';
import type { CommandOptions, CommandResult } from '../../types/command.js';
import type { SmokeContext } from '../../types/context.js';
import type { DurationString } from '../../types/duration.js';
import type { ComposeCommandRecord } from './errors.js';

export class ComposeCommandRunner {
    public readonly history: ComposeCommandRecord[] = [];

    constructor(
        private readonly t: SmokeContext,
        private readonly docker: string,
        private readonly projectName: string,
        private readonly cwd: string,
        private readonly files: string[],
        private readonly env: Record<string, string | undefined> | undefined,
        private readonly timeout: DurationString | undefined,
    ) {}

    public async run(
        label: string,
        args: string[],
        options: { check?: boolean } = {},
    ): Promise<CommandResult> {
        const commandArgs = [
            'compose',
            '--project-name',
            this.projectName,
            ...fileArgs(this.files),
            ...args,
        ];
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
            throw new SmokeError(
                `Docker Compose ${label} failed with exit code ${String(result.exitCode)}.`,
                {
                    projectName: this.projectName,
                    command: result.command,
                    args: result.args,
                    cwd: result.cwd,
                    exitCode: result.exitCode,
                    stdout: result.stdout,
                    stderr: result.stderr,
                },
            );
        }

        return result;
    }
}

function fileArgs(files: string[]): string[] {
    return files.flatMap((file) => ['--file', file]);
}
