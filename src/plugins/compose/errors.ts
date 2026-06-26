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

export function wrapComposeError(error: unknown, projectName: string): SmokeError {
    if (error instanceof SmokeError) {
        return error;
    }

    return new SmokeError(`Docker Compose project ${projectName} failed: ${formatError(error)}`, {
        projectName,
    });
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
