import type {
    CommandOptions,
    CommandResult,
    SmokeContext,
} from '../../../../dist/types.js';

export function withPackCommandOutput(
    context: SmokeContext,
    stdout: string,
    stderr = '',
): SmokeContext {
    return {
        ...context,
        async cmd(
            command: string,
            args: string[] = [],
            options: CommandOptions = {},
        ): Promise<CommandResult> {
            await Promise.resolve();
            return {
                command,
                args,
                cwd: options.cwd?.toString() ?? context.repoRoot().toString(),
                durationMs: 1,
                exitCode: 0,
                stdout,
                stderr,
            };
        },
    };
}
