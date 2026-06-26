import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import type { CommandOptions, DurationString, PathRef, SmokeContext } from '../../types.js';

export interface ComposeCheckOptions {
    docker?: string;
    cwd?: string | PathRef;
    env?: Record<string, string | undefined>;
    timeout?: DurationString;
}

export interface ComposeInfo {
    docker: {
        command: string;
        version?: string;
        path?: string;
    };
    compose: {
        version?: string;
    };
}

export async function composeCheck(
    t: SmokeContext,
    options: ComposeCheckOptions = {},
): Promise<ComposeInfo> {
    const docker = options.docker === undefined ? await t.tools.docker() : { command: options.docker };
    const cwd = pathToString(options.cwd ?? t.repoRoot());
    const commandOptions: CommandOptions = {
        cwd,
        check: false,
    };
    if (options.env !== undefined) {
        commandOptions.env = options.env;
    }
    if (options.timeout !== undefined) {
        commandOptions.timeout = options.timeout;
    }

    const versionResult = await t.cmd(docker.command, ['compose', 'version', '--short'], commandOptions);

    if (versionResult.exitCode !== 0) {
        throw new SmokeError('Docker Compose is not available through the Docker CLI.', {
            command: docker.command,
            args: versionResult.args,
            cwd,
            exitCode: versionResult.exitCode,
            stdout: versionResult.stdout,
            stderr: versionResult.stderr,
            installHint: 'Install Docker Desktop or a Docker CLI with the compose plugin.',
        });
    }

    const info: ComposeInfo = {
        docker,
        compose: {},
    };
    const composeVersion = versionResult.stdout.trim();
    if (composeVersion.length > 0) {
        info.compose.version = composeVersion;
    }

    return info;
}
