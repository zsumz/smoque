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
