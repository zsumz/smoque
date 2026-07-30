import { CommandFailedError } from '../errors.js';
import { reservedPortErrorDetails } from '../ports.js';
import type { CommandResult } from '../types/command.js';
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
            ...reservedPortErrorDetails(input.options?.env),
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
            ...reservedPortErrorDetails(input.options?.env),
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
                ...reservedPortErrorDetails(input.options?.env),
                stdout: result.stdout,
                stderr: result.stderr,
            },
        );
    }

    return result;
}

function formatCommand(result: CommandResult): string {
    return [result.command, ...result.args].join(' ');
}
