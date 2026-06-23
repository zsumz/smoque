import type { SerializedSmokeError, SmokeEventSink } from '../events.js';
import type { PathRef } from './common.js';

export interface SuiteOptions {
    tags?: string[];
    skip?: boolean | string;
}

export interface StepOptions {
    continueOnFailure?: boolean;
}

export interface SmokeSuite {
    id: string;
    name: string;
    file?: string;
    tags: string[];
}

export interface SmokeRunOptions {
    repoRoot?: string | PathRef;
    runId?: string;
    keepWorkdirOnFail?: boolean;
    suiteIds?: string[];
    tags?: string[];
    skipTags?: string[];
    updateSnapshots?: boolean;
    eventSink?: SmokeEventSink;
}

export interface SmokeRunResult {
    runId: string;
    status: 'passed' | 'failed';
    suites: SmokeSuiteResult[];
    durationMs: number;
}

export interface SmokeSuiteResult {
    suite: SmokeSuite;
    status: 'passed' | 'failed' | 'skipped';
    steps: SmokeStepResult[];
    durationMs: number;
    error?: SerializedSmokeError;
    cleanupErrors: SerializedSmokeError[];
}

export interface SmokeStepResult {
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    durationMs: number;
    error?: SerializedSmokeError;
    skipReason?: string;
}
