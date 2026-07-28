import type { SmokeEvent } from '../events.js';
import type {
    JsonRunReport,
    JsonStepReport,
    JsonSuiteReport,
} from './event-report-types.js';

export interface EventReportState {
    events: SmokeEvent[];
    suites: Map<string, JsonSuiteReport>;
    steps: Map<string, JsonStepReport>;
    stepToSuite: Map<string, string>;
    run: JsonRunReport;
}

export function createEventReportState(): EventReportState {
    return {
        events: [],
        suites: new Map(),
        steps: new Map(),
        stepToSuite: new Map(),
        run: {
            id: '',
            startedAt: '',
        },
    };
}

export function ensureReportSuite(
    state: EventReportState,
    suiteId: string,
    name = suiteId,
): JsonSuiteReport {
    const existing = state.suites.get(suiteId);
    if (existing) {
        return existing;
    }

    const suite: JsonSuiteReport = {
        id: suiteId,
        name,
        tags: [],
        steps: [],
        logs: [],
        artifacts: [],
    };
    state.suites.set(suiteId, suite);
    return suite;
}

export function reportStepForCommand(
    state: EventReportState,
    stepId: string | undefined,
): JsonStepReport | undefined {
    if (!stepId) {
        return undefined;
    }
    return state.steps.get(stepId);
}
