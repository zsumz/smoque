import { CommandFailedError } from '../errors.js';
import { reservedPortsFromEnv } from '../ports.js';
import type { CommandOptions, CommandResult } from '../types.js';
import { emitCommandFinished } from './command-events.js';
import type { RunCommandInput } from './run-command.js';

export async function finishCommand(
    input: RunCommandInput,
    outputEvents: Array<Promise<void>>,
    result: CommandResult,
    spawnError: Error | undefined,
    timedOut: boolean,
): Promise<CommandResult> {
    await Promise.all(outputEvents);
    await emitCommandFinished(
        input.eventSink,
        input.stepId,
        result.exitCode,
        result.durationMs,
    );

    if (spawnError) {
        throw new CommandFailedError(`Command failed to start: ${input.command}`, {
            command: input.command,
            args: result.args,
            cwd: result.cwd,
            ...reservedPortDetails(input.options),
            cause: spawnError.message,
        });
    }

    if (timedOut) {
        throw new CommandFailedError(`Command timed out: ${formatCommand(result)}`, {
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            timeout: input.options?.timeout,
            durationMs: result.durationMs,
            ...reservedPortDetails(input.options),
            stdout: result.stdout,
            stderr: result.stderr,
        });
    }

    if (input.options?.check !== false && result.exitCode !== 0) {
        throw new CommandFailedError(
            `Command failed with exit code ${String(result.exitCode)}: ${formatCommand(result)}`,
            {
                command: result.command,
                args: result.args,
                cwd: result.cwd,
                exitCode: result.exitCode,
                durationMs: result.durationMs,
                ...reservedPortDetails(input.options),
                stdout: result.stdout,
                stderr: result.stderr,
            },
        );
    }

    return result;
}

function reservedPortDetails(
    options: CommandOptions | undefined,
): { reservedPorts?: Record<string, unknown> } {
    const reservedPorts = reservedPortsFromEnv(options?.env);
    return reservedPorts === undefined ? {} : { reservedPorts };
}

function formatCommand(result: CommandResult): string {
    return [result.command, ...result.args].join(' ');
}
