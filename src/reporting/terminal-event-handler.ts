import type { SmokeEvent } from '../events.js';
import type { JsonCommandReport } from './event-report-builder.js';
import {
    excerptText,
    formatDuration,
} from './format/terminal.js';
import {
    writeTerminalFailures,
    type TerminalWrite,
} from './terminal-failure-output.js';
import type {
    TerminalFailure,
    TerminalReportState,
} from './terminal-report-state.js';

export async function handleTerminalEvent(
    state: TerminalReportState,
    event: SmokeEvent,
    write: TerminalWrite,
    finish: () => Promise<void>,
): Promise<void> {
    switch (event.type) {
        case 'run.started':
            await write('smoque\n\n');
            return;
        case 'suite.discovered':
            state.suites.set(event.suiteId, { name: event.name, steps: new Map() });
            return;
        case 'suite.started':
            state.ensureSuite(event.suiteId, event.name);
            await write(`${event.name}\n`);
            return;
        case 'step.started':
            state.ensureSuite(event.suiteId).steps.set(event.stepId, event.name);
            return;
        case 'step.passed':
            await write(
                `  PASS ${state.stepName(event.stepId)} ${formatDuration(event.durationMs)}\n`,
            );
            return;
        case 'step.skipped':
            await write(
                `  SKIP ${state.stepName(event.stepId)} ${formatDuration(event.durationMs)}\n`,
            );
            return;
        case 'step.failed': {
            const suite = state.suiteForStep(event.stepId);
            const stepName = state.stepName(event.stepId);
            const command = state.commands.get(event.stepId)?.at(-1);
            const suiteId = state.suiteIdForStep(event.stepId);
            const artifacts = [
                ...suiteId ? state.suiteArtifacts.get(suiteId) ?? [] : [],
                ...state.stepArtifacts.get(event.stepId) ?? [],
            ];
            const failure: TerminalFailure = {
                suite: suite.name,
                step: stepName,
                error: event.error,
                artifacts,
            };
            if (command) {
                failure.command = command;
            }
            state.failures.push(failure);
            await write(`  FAIL ${stepName} ${formatDuration(event.durationMs)}\n`);
            return;
        }
        case 'suite.finished':
            if (state.ensureSuite(event.suiteId).steps.size === 0) {
                await write(
                    `  ${event.status.toUpperCase()} ${formatDuration(event.durationMs)}\n`,
                );
            }
            return;
        case 'command.started':
            if (event.stepId) {
                const command: JsonCommandReport = {
                    command: event.command,
                    args: [...event.args],
                    cwd: event.cwd,
                    stdout: '',
                    stderr: '',
                };
                const commands = state.commands.get(event.stepId) ?? [];
                commands.push(command);
                state.commands.set(event.stepId, commands);
            }
            return;
        case 'command.output': {
            const command = event.stepId
                ? state.commands.get(event.stepId)?.at(-1)
                : undefined;
            if (command) {
                command[event.stream] += event.text;
            }
            return;
        }
        case 'command.finished': {
            const command = event.stepId
                ? state.commands.get(event.stepId)?.at(-1)
                : undefined;
            if (command) {
                command.exitCode = event.exitCode;
                command.durationMs = event.durationMs;
            }
            return;
        }
        case 'log.message':
            await write(`  LOG ${formatLogMessage(event.message)}\n`);
            return;
        case 'run.finished':
            await write(`\nResult: ${event.status} ${formatDuration(event.durationMs)}\n`);
            await writeTerminalFailures(state.failures, write);
            await finish();
            return;
        case 'artifact.attached': {
            const artifact = {
                name: event.name,
                path: event.path,
                kind: event.kind,
            };
            if (event.stepId) {
                const artifacts = state.stepArtifacts.get(event.stepId) ?? [];
                artifacts.push(artifact);
                state.stepArtifacts.set(event.stepId, artifacts);
                return;
            }
            if (event.suiteId) {
                const artifacts = state.suiteArtifacts.get(event.suiteId) ?? [];
                artifacts.push(artifact);
                state.suiteArtifacts.set(event.suiteId, artifacts);
            }
            return;
        }
    }
}

function formatLogMessage(message: string): string {
    return excerptText(message).replace(/\r?\n/gu, '\n      ');
}
