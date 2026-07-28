import type { RunCommandInput } from '../../command/run-command.js';
import { Redactor } from '../../redaction.js';
import { createSmokeContext } from '../context/smoke-context.js';
import type { ExtensionBucket } from '../plugin-registry.js';
import { runContextCommand } from './context-command.js';
import { emitSmokeEvent } from './events.js';
import { serializeError } from './error-serialization.js';
import { SuiteResourceTracker } from './suite-resource-tracker.js';
import { SuiteStepRunner } from './suite-step-runner.js';
import type { SerializedSmokeError, SmokeEvent, SmokeEventSink } from '../../events.js';
import type { SmokeContext } from '../../types/context.js';
import type { PathRef } from '../../types/path-ref.js';
import type { SmokeStepResult, SmokeSuite } from '../../types/suite.js';

export class SuiteExecutor {
    public readonly context: SmokeContext;
    public preserveManagedWorkdirs = false;

    private readonly redactor = new Redactor();
    private readonly resourceTracker = new SuiteResourceTracker(
        (error) => this.serializeError(error),
    );
    private readonly stepRunner: SuiteStepRunner;

    constructor(
        private readonly suite: SmokeSuite,
        private readonly root: PathRef,
        private readonly extensions: ExtensionBucket,
        private readonly keepWorkdirOnFail: boolean,
        private readonly eventSink: SmokeEventSink | undefined,
    ) {
        this.stepRunner = new SuiteStepRunner(
            this.suite.id,
            async (event) => this.emit(event),
            (error) => this.serializeError(error),
        );
        this.context = createSmokeContext({
            suite: this.suite,
            root: this.root,
            extensions: this.extensions,
            keepWorkdirOnFail: this.keepWorkdirOnFail,
            preserveManagedWorkdirs: () => this.preserveManagedWorkdirs,
            currentStepId: () => this.stepRunner.currentStepId,
            runStep: async (name, options, fn) => this.stepRunner.run(name, options, fn),
            runCommand: async (command, args, options) => this.runContextCommand(command, args, options),
            addCleanup: (fn) => {
                this.resourceTracker.addCleanup(fn);
            },
            addResource: (resource) => {
                this.resourceTracker.add(resource);
            },
            addManagedResource: (resource) => {
                this.resourceTracker.addManaged(resource);
            },
            addRedaction: (value, options) => {
                this.redactor.add(value, options);
            },
            redactText: (value) => this.redactor.text(value),
            emit: async (event) => this.emit(event),
        });
    }

    public get steps(): SmokeStepResult[] {
        return this.stepRunner.steps;
    }

    public get firstContinuedFailure(): SerializedSmokeError | undefined {
        return this.stepRunner.firstContinuedFailure;
    }

    public async runCleanup(): Promise<SerializedSmokeError[]> {
        return this.resourceTracker.cleanup();
    }

    public async attachResourcesOnFailure(): Promise<SerializedSmokeError[]> {
        return this.resourceTracker.attachOnFailure(this.context.attach);
    }

    public serializeError(error: unknown): SerializedSmokeError {
        return this.redactor.error(serializeError(error));
    }

    private async runContextCommand(
        command: string,
        args: string[],
        options: RunCommandInput['options'],
    ): Promise<Awaited<ReturnType<typeof runContextCommand>>> {
        return runContextCommand(
            command,
            args,
            options,
            this.root,
            this.stepRunner.currentStepId,
            this.eventSink === undefined ? undefined : this.redactingEventSink(),
        );
    }

    private redactingEventSink(): SmokeEventSink {
        return {
            emit: async (event) => this.emit(event),
        };
    }

    private async emit(event: SmokeEvent): Promise<void> {
        await emitSmokeEvent(this.eventSink, this.redactor.event(event));
    }
}
