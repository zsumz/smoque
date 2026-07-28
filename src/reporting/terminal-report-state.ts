import type { SerializedSmokeError } from '../events.js';
import type {
    JsonArtifactReport,
    JsonCommandReport,
} from './event-report-builder.js';

export interface TerminalSuiteState {
    name: string;
    steps: Map<string, string>;
}

export interface TerminalFailure {
    suite: string;
    step?: string;
    error: SerializedSmokeError;
    command?: JsonCommandReport;
    artifacts: JsonArtifactReport[];
}

export class TerminalReportState {
    public readonly suites: Map<string, TerminalSuiteState> = new Map();
    public readonly commands: Map<string, JsonCommandReport[]> = new Map();
    public readonly stepArtifacts: Map<string, JsonArtifactReport[]> = new Map();
    public readonly suiteArtifacts: Map<string, JsonArtifactReport[]> = new Map();
    public readonly failures: TerminalFailure[] = [];

    public ensureSuite(suiteId: string, name = suiteId): TerminalSuiteState {
        const existing = this.suites.get(suiteId);
        if (existing) {
            return existing;
        }

        const suite = { name, steps: new Map<string, string>() };
        this.suites.set(suiteId, suite);
        return suite;
    }

    public suiteForStep(stepId: string): TerminalSuiteState {
        const suiteId = this.suiteIdForStep(stepId);
        if (suiteId) {
            return (
                this.suites.get(suiteId)
                ?? { name: '<unknown suite>', steps: new Map([[stepId, stepId]]) }
            );
        }

        return { name: '<unknown suite>', steps: new Map([[stepId, stepId]]) };
    }

    public suiteIdForStep(stepId: string): string | undefined {
        for (const [suiteId, suite] of this.suites) {
            if (suite.steps.has(stepId)) {
                return suiteId;
            }
        }
        return undefined;
    }

    public stepName(stepId: string): string {
        return this.suiteForStep(stepId).steps.get(stepId) ?? stepId;
    }
}
