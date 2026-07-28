import type { SmokeEvent } from '../events.js';
import {
    ensureReportSuite,
    reportStepForCommand,
    type EventReportState,
} from './event-report-state.js';
import type {
    JsonCommandReport,
    JsonStepReport,
} from './event-report-types.js';

export function applyEventToReport(state: EventReportState, event: SmokeEvent): void {
    state.events.push(event);

    switch (event.type) {
        case 'run.started':
            state.run.id = event.runId;
            state.run.startedAt = event.startedAt;
            return;
        case 'run.finished':
            state.run.status = event.status;
            state.run.durationMs = event.durationMs;
            return;
        case 'suite.discovered':
            state.suites.set(event.suiteId, {
                id: event.suiteId,
                name: event.name,
                file: event.file,
                tags: [...event.tags],
                steps: [],
                logs: [],
                artifacts: [],
            });
            return;
        case 'suite.started':
            ensureReportSuite(state, event.suiteId, event.name);
            return;
        case 'suite.finished': {
            const suite = ensureReportSuite(state, event.suiteId);
            suite.status = event.status;
            suite.durationMs = event.durationMs;
            return;
        }
        case 'step.started': {
            const suite = ensureReportSuite(state, event.suiteId);
            const step: JsonStepReport = {
                id: event.stepId,
                name: event.name,
                commands: [],
                logs: [],
                artifacts: [],
            };
            suite.steps.push(step);
            state.steps.set(event.stepId, step);
            state.stepToSuite.set(event.stepId, event.suiteId);
            return;
        }
        case 'step.passed': {
            const step = state.steps.get(event.stepId);
            if (step) {
                step.status = 'passed';
                step.durationMs = event.durationMs;
            }
            return;
        }
        case 'step.skipped': {
            const step = state.steps.get(event.stepId);
            if (step) {
                step.status = 'skipped';
                step.durationMs = event.durationMs;
                step.skipReason = event.reason;
            }
            return;
        }
        case 'step.failed': {
            const step = state.steps.get(event.stepId);
            if (step) {
                step.status = 'failed';
                step.durationMs = event.durationMs;
                step.error = event.error;
            }
            return;
        }
        case 'command.started': {
            const command: JsonCommandReport = {
                command: event.command,
                args: [...event.args],
                cwd: event.cwd,
                stdout: '',
                stderr: '',
            };
            reportStepForCommand(state, event.stepId)?.commands.push(command);
            return;
        }
        case 'command.output': {
            const command = lastCommand(reportStepForCommand(state, event.stepId));
            if (command) {
                command[event.stream] += event.text;
            }
            return;
        }
        case 'command.finished': {
            const command = lastCommand(reportStepForCommand(state, event.stepId));
            if (command) {
                command.exitCode = event.exitCode;
                command.durationMs = event.durationMs;
            }
            return;
        }
        case 'log.message': {
            const log = { message: event.message };
            if (event.stepId) {
                state.steps.get(event.stepId)?.logs.push(log);
                return;
            }
            ensureReportSuite(state, event.suiteId).logs.push(log);
            return;
        }
        case 'artifact.attached': {
            const artifact = {
                name: event.name,
                path: event.path,
                kind: event.kind,
            };
            if (event.stepId) {
                state.steps.get(event.stepId)?.artifacts.push(artifact);
                return;
            }
            if (event.suiteId) {
                ensureReportSuite(state, event.suiteId).artifacts.push(artifact);
            }
            return;
        }
    }
}

function lastCommand(step: JsonStepReport | undefined): JsonCommandReport | undefined {
    return step?.commands.at(-1);
}
