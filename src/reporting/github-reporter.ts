import type { SmokeEvent, SmokeEventSink, SerializedSmokeError } from '../events.js';
import { escapeWorkflowData, escapeWorkflowProperty } from './format/github.js';

export interface GitHubReporterOptions {
    write?: (text: string) => Promise<void> | void;
}

export interface GitHubReporter extends SmokeEventSink {
    finish(): Promise<void>;
}

export function createGitHubReporter(options: GitHubReporterOptions = {}): GitHubReporter {
    return new GitHubReporterImpl(options);
}

class GitHubReporterImpl implements GitHubReporter {
    private readonly suites: Map<string, { name: string; file?: string }> = new Map();
    private readonly steps: Map<string, { suiteId: string; name: string }> = new Map();
    private finished = false;

    constructor(private readonly options: GitHubReporterOptions) {}

    public async emit(event: SmokeEvent): Promise<void> {
        switch (event.type) {
            case 'suite.discovered':
                this.suites.set(event.suiteId, { name: event.name, file: event.file });
                return;
            case 'suite.started':
                this.ensureSuite(event.suiteId, event.name);
                return;
            case 'step.started':
                this.steps.set(event.stepId, { suiteId: event.suiteId, name: event.name });
                return;
            case 'step.failed':
                await this.writeStepFailure(event.stepId, event.error);
                return;
            case 'run.finished':
                await this.finish();
                return;
            case 'artifact.attached':
            case 'command.finished':
            case 'command.output':
            case 'command.started':
            case 'log.message':
            case 'run.started':
            case 'step.passed':
            case 'step.skipped':
            case 'suite.finished':
                return;
        }
    }

    public async finish(): Promise<void> {
        this.finished = true;
        return Promise.resolve();
    }

    private ensureSuite(suiteId: string, name = suiteId): { name: string; file?: string } {
        const existing = this.suites.get(suiteId);
        if (existing) {
            return existing;
        }

        const suite = { name };
        this.suites.set(suiteId, suite);
        return suite;
    }

    private async writeStepFailure(stepId: string, error: SerializedSmokeError): Promise<void> {
        const step = this.steps.get(stepId);
        const suite = step ? this.ensureSuite(step.suiteId) : undefined;
        const title = [suite?.name, step?.name].filter(Boolean).join(' > ') || stepId;
        const properties = [`title=${escapeWorkflowProperty(title)}`];

        if (suite?.file) {
            properties.unshift(`file=${escapeWorkflowProperty(suite.file)}`);
        }

        await this.write(
            `::error ${properties.join(',')}::${escapeWorkflowData(`${error.name}: ${error.message}`)}\n`,
        );
    }

    private async write(text: string): Promise<void> {
        if (this.options.write) {
            await this.options.write(text);
            return;
        }
        process.stdout.write(text);
    }
}
