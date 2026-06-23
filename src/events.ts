export type SmokeEvent =
  | RunStartedEvent
  | SuiteDiscoveredEvent
  | SuiteStartedEvent
  | StepStartedEvent
  | CommandStartedEvent
  | CommandOutputEvent
  | CommandFinishedEvent
  | LogMessageEvent
  | ArtifactAttachedEvent
  | StepPassedEvent
  | StepSkippedEvent
  | StepFailedEvent
  | SuiteFinishedEvent
  | RunFinishedEvent;

export interface RunStartedEvent {
    type: 'run.started';
    runId: string;
    startedAt: string;
}

export interface SuiteDiscoveredEvent {
    type: 'suite.discovered';
    suiteId: string;
    name: string;
    file: string;
    tags: string[];
}

export interface SuiteStartedEvent {
    type: 'suite.started';
    suiteId: string;
    name: string;
}

export interface StepStartedEvent {
    type: 'step.started';
    suiteId: string;
    stepId: string;
    name: string;
}

export interface CommandStartedEvent {
    type: 'command.started';
    stepId?: string;
    command: string;
    args: string[];
    cwd: string;
}

export interface CommandOutputEvent {
    type: 'command.output';
    stepId?: string;
    stream: 'stdout' | 'stderr';
    text: string;
}

export interface CommandFinishedEvent {
    type: 'command.finished';
    stepId?: string;
    exitCode: number;
    durationMs: number;
}

export interface LogMessageEvent {
    type: 'log.message';
    suiteId: string;
    stepId?: string;
    message: string;
}

export interface ArtifactAttachedEvent {
    type: 'artifact.attached';
    suiteId?: string;
    stepId?: string;
    name: string;
    path: string;
    kind: string;
}

export interface StepPassedEvent {
    type: 'step.passed';
    stepId: string;
    durationMs: number;
}

export interface StepSkippedEvent {
    type: 'step.skipped';
    stepId: string;
    reason: string;
    durationMs: number;
}

export interface StepFailedEvent {
    type: 'step.failed';
    stepId: string;
    error: SerializedSmokeError;
    durationMs: number;
}

export interface SuiteFinishedEvent {
    type: 'suite.finished';
    suiteId: string;
    status: 'passed' | 'failed' | 'skipped';
    durationMs: number;
}

export interface RunFinishedEvent {
    type: 'run.finished';
    status: 'passed' | 'failed';
    durationMs: number;
}

export interface SerializedSmokeError {
    name: string;
    message: string;
    stack?: string;
    details?: Record<string, unknown>;
}

export interface SmokeEventSink {
    emit(event: SmokeEvent): void | Promise<void>;
}
