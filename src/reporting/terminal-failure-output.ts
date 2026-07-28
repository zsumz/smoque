import type { JsonArtifactReport } from './event-report-builder.js';
import {
    excerptText,
    formatDetailValue,
    indent,
} from './format/terminal.js';
import type { TerminalFailure } from './terminal-report-state.js';

export type TerminalWrite = (text: string) => Promise<void>;

export async function writeTerminalFailures(
    failures: readonly TerminalFailure[],
    write: TerminalWrite,
): Promise<void> {
    for (const failure of failures) {
        const title = failure.step ? `${failure.suite} > ${failure.step}` : failure.suite;
        await write(`\nFailure: ${title}\n\n`);
        await write(`${failure.error.name}: ${failure.error.message}\n`);

        if (failure.command) {
            await write('\nCommand:\n');
            await write(`  ${[failure.command.command, ...failure.command.args].join(' ')}\n`);
            await write('\nWorking directory:\n');
            await write(`  ${failure.command.cwd}\n`);
            if (failure.command.exitCode !== undefined) {
                await write('\nExit code:\n');
                await write(`  ${String(failure.command.exitCode)}\n`);
            }
            if (failure.command.stderr) {
                await write('\nstderr:\n');
                await write(indent(excerptText(failure.command.stderr)));
            }
            if (failure.command.stdout) {
                await write('\nstdout:\n');
                await write(indent(excerptText(failure.command.stdout)));
            }
        } else if (failure.error.details) {
            await writeErrorDetails(failure.error.details, write);
        }

        await writeArtifacts(failure.artifacts, write);
    }
}

async function writeArtifacts(
    artifacts: JsonArtifactReport[],
    write: TerminalWrite,
): Promise<void> {
    if (artifacts.length === 0) {
        return;
    }

    await write('\nArtifacts:\n');
    for (const artifact of artifacts) {
        await write(`  ${artifact.name}: ${artifact.path}\n`);
    }
}

async function writeErrorDetails(
    details: Record<string, unknown>,
    write: TerminalWrite,
): Promise<void> {
    const entries = Object.entries(details).filter(
        ([, value]) => value !== undefined && value !== '',
    );
    if (entries.length === 0) {
        return;
    }

    await write('\nDetails:\n');
    for (const [key, value] of entries) {
        if ((key === 'stdout' || key === 'stderr') && typeof value === 'string') {
            await write(`${key}:\n`);
            await write(indent(excerptText(value)));
        } else {
            await write(`  ${key}: ${formatDetailValue(value)}\n`);
        }
    }
}
