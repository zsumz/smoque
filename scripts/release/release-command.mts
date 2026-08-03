import { spawnSync } from 'node:child_process';

export interface CommandResult {
    stdout: string;
    stderr: string;
}

export function runReleaseCommand(
    command: string,
    args: readonly string[],
    cwd: string,
): CommandResult {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        env: process.env,
    });
    const stdout = commandOutput(result.stdout);
    const stderr = commandOutput(result.stderr);
    if (result.status !== 0) {
        throw new Error([
            `Release command failed: ${command} ${args.join(' ')}`,
            result.error?.message,
            stdout.trim(),
            stderr.trim(),
        ].filter(Boolean).join('\n'));
    }
    return {
        stdout,
        stderr,
    };
}

function commandOutput(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function releaseCommandSucceeds(
    command: string,
    args: readonly string[],
    cwd: string,
): boolean {
    return spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        env: process.env,
    }).status === 0;
}
