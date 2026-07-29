import { SmokeError } from '../../errors.js';

export interface ComposeCommandRecord {
    label: string;
    command: string;
    args: string[];
    cwd: string;
    exitCode: number;
    stdout: string;
    stderr: string;
}

export interface ComposeRecoveryError {
    phase: 'evidence' | 'cleanup';
    message: string;
}

export function wrapComposeError(
    error: unknown,
    projectName: string,
    recoveryErrors: ComposeRecoveryError[] = [],
): SmokeError {
    if (error instanceof SmokeError && recoveryErrors.length === 0) {
        return error;
    }

    const message = error instanceof SmokeError
        ? error.message
        : `Docker Compose project ${projectName} failed: ${formatError(error)}`;
    const details = error instanceof SmokeError ? error.details : undefined;
    const wrapped = new SmokeError(message, {
        ...details ?? {},
        projectName,
        ...recoveryErrors.length === 0 ? {} : { recoveryErrors },
    });

    if (error instanceof SmokeError) {
        wrapped.name = error.name;
    }

    return wrapped;
}

export function formatCommandHistory(history: ComposeCommandRecord[]): string {
    if (history.length === 0) {
        return 'No Docker Compose commands were recorded.';
    }

    return history.map((record) => {
        return [
            `$ ${record.command} ${record.args.join(' ')}`,
            `cwd: ${record.cwd}`,
            `exit: ${String(record.exitCode)}`,
            section('stdout', record.stdout),
            section('stderr', record.stderr),
        ].join('\n');
    }).join('\n\n');
}

export function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function section(name: string, value: string): string {
    return `${name}:\n${value.trimEnd() || '<empty>'}`;
}
