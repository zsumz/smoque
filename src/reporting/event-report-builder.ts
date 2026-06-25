import type { SmokeEvent, SerializedSmokeError } from '../events.js';

export interface JsonSmokeReport {
    schemaVersion: 'smoque.report.v1';
    run: JsonRunReport;
    suites: JsonSuiteReport[];
    events?: SmokeEvent[];
}

export interface JsonRunReport {
    id: string;
    startedAt: string;
    status?: 'passed' | 'failed';
    durationMs?: number;
}

export interface JsonSuiteReport {
    id: string;
    name: string;
    file?: string;
    tags: string[];
    status?: 'passed' | 'failed' | 'skipped';
    durationMs?: number;
    steps: JsonStepReport[];
    logs: JsonLogReport[];
    artifacts: JsonArtifactReport[];
}

export interface JsonStepReport {
    id: string;
    name: string;
    status?: 'passed' | 'failed' | 'skipped';
    durationMs?: number;
    error?: SerializedSmokeError;
    skipReason?: string;
    commands: JsonCommandReport[];
    logs: JsonLogReport[];
    artifacts: JsonArtifactReport[];
}

export interface JsonLogReport {
    message: string;
}

export interface JsonCommandReport {
    command: string;
    args: string[];
    cwd: string;
    exitCode?: number;
    durationMs?: number;
    stdout: string;
    stderr: string;
}

export interface JsonArtifactReport {
    name: string;
    path: string;
    kind: string;
}

export interface EventReportBuilderOptions {
    includeEvents?: boolean;
}

export class EventReportBuilder {
    private readonly events: SmokeEvent[] = [];
    private readonly suites: Map<string, JsonSuiteReport> = new Map();
    private readonly steps: Map<string, JsonStepReport> = new Map();
    private readonly stepToSuite: Map<string, string> = new Map();
    private readonly run: JsonRunReport = {
        id: '',
        startedAt: '',
    };

    public apply(event: SmokeEvent): void {
        this.events.push(event);

        switch (event.type) {
            case 'run.started':
                this.run.id = event.runId;
                this.run.startedAt = event.startedAt;
                return;
            case 'run.finished':
                this.run.status = event.status;
                this.run.durationMs = event.durationMs;
                return;
            case 'suite.discovered':
                this.suites.set(event.suiteId, {
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
                this.ensureSuite(event.suiteId, event.name);
                return;
            case 'suite.finished': {
                const suite = this.ensureSuite(event.suiteId);
                suite.status = event.status;
                suite.durationMs = event.durationMs;
                return;
            }
            case 'step.started': {
                const suite = this.ensureSuite(event.suiteId);
                const step: JsonStepReport = {
                    id: event.stepId,
                    name: event.name,
                    commands: [],
                    logs: [],
                    artifacts: [],
                };
                suite.steps.push(step);
                this.steps.set(event.stepId, step);
                this.stepToSuite.set(event.stepId, event.suiteId);
                return;
            }
            case 'step.passed': {
                const step = this.steps.get(event.stepId);
                if (step) {
                    step.status = 'passed';
                    step.durationMs = event.durationMs;
                }
                return;
            }
            case 'step.skipped': {
                const step = this.steps.get(event.stepId);
                if (step) {
                    step.status = 'skipped';
                    step.durationMs = event.durationMs;
                    step.skipReason = event.reason;
                }
                return;
            }
            case 'step.failed': {
                const step = this.steps.get(event.stepId);
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
                this.stepForCommand(event.stepId)?.commands.push(command);
                return;
            }
            case 'command.output': {
                const command = lastCommand(this.stepForCommand(event.stepId));
                if (command) {
                    command[event.stream] += event.text;
                }
                return;
            }
            case 'command.finished': {
                const command = lastCommand(this.stepForCommand(event.stepId));
                if (command) {
                    command.exitCode = event.exitCode;
                    command.durationMs = event.durationMs;
                }
                return;
            }
            case 'log.message': {
                const log = { message: event.message };
                if (event.stepId) {
                    this.steps.get(event.stepId)?.logs.push(log);
                    return;
                }
                this.ensureSuite(event.suiteId).logs.push(log);
                return;
            }
            case 'artifact.attached': {
                const artifact = {
                    name: event.name,
                    path: event.path,
                    kind: event.kind,
                };
                if (event.stepId) {
                    this.steps.get(event.stepId)?.artifacts.push(artifact);
                    return;
                }
                if (event.suiteId) {
                    this.ensureSuite(event.suiteId).artifacts.push(artifact);
                }
                return;
            }
        }
    }

    public report(options: EventReportBuilderOptions = {}): JsonSmokeReport {
        const report: JsonSmokeReport = {
            schemaVersion: 'smoque.report.v1',
            run: { ...this.run },
            suites: Array.from(this.suites.values()).map(cloneSuite),
        };

        if (options.includeEvents) {
            report.events = this.events.map((event) => ({ ...event }));
        }

        return report;
    }

    private ensureSuite(suiteId: string, name = suiteId): JsonSuiteReport {
        const existing = this.suites.get(suiteId);
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
        this.suites.set(suiteId, suite);
        return suite;
    }

    private stepForCommand(stepId: string | undefined): JsonStepReport | undefined {
        if (!stepId) {
            return undefined;
        }
        return this.steps.get(stepId);
    }
}

function lastCommand(step: JsonStepReport | undefined): JsonCommandReport | undefined {
    return step?.commands.at(-1);
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
