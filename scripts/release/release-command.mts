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
    if (result.status !== 0) {
        throw new Error([
            `Release command failed: ${command} ${args.join(' ')}`,
            result.stdout.trim(),
            result.stderr.trim(),
        ].filter(Boolean).join('\n'));
    }
    return {
        stdout: result.stdout,
        stderr: result.stderr,
    };
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
