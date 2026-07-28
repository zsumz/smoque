import type { EventReportState } from './event-report-state.js';
import type {
    EventReportBuilderOptions,
    JsonSmokeReport,
    JsonStepReport,
    JsonSuiteReport,
} from './event-report-types.js';

export function createEventReportSnapshot(
    state: EventReportState,
    options: EventReportBuilderOptions,
): JsonSmokeReport {
    const report: JsonSmokeReport = {
        schemaVersion: 'smoque.report.v1',
        run: { ...state.run },
        suites: Array.from(state.suites.values()).map(cloneSuite),
    };

    if (options.includeEvents) {
        report.events = state.events.map((event) => ({ ...event }));
    }

    return report;
}

function cloneSuite(suite: JsonSuiteReport): JsonSuiteReport {
    const clone: JsonSuiteReport = {
        id: suite.id,
        name: suite.name,
        tags: [...suite.tags],
        steps: suite.steps.map(cloneStep),
        logs: suite.logs.map((log) => ({ ...log })),
        artifacts: suite.artifacts.map((artifact) => ({ ...artifact })),
    };

    if (suite.file !== undefined) {
        clone.file = suite.file;
    }
    if (suite.status !== undefined) {
        clone.status = suite.status;
    }
    if (suite.durationMs !== undefined) {
        clone.durationMs = suite.durationMs;
    }

    return clone;
}

function cloneStep(step: JsonStepReport): JsonStepReport {
    const clone: JsonStepReport = {
        id: step.id,
        name: step.name,
        commands: step.commands.map((command) => ({
            ...command,
            args: [...command.args],
        })),
        logs: step.logs.map((log) => ({ ...log })),
        artifacts: step.artifacts.map((artifact) => ({ ...artifact })),
    };

    if (step.status !== undefined) {
        clone.status = step.status;
    }
    if (step.durationMs !== undefined) {
        clone.durationMs = step.durationMs;
    }
    if (step.error !== undefined) {
        clone.error = { ...step.error };
    }
    if (step.skipReason !== undefined) {
        clone.skipReason = step.skipReason;
    }

    return clone;
}
