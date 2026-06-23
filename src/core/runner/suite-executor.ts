import { runCommand, type RunCommandInput } from '../../command.js';
import { Redactor } from '../../redaction.js';
import { SmokeSkipSignal } from '../context/skip-signal.js';
import { createSmokeContext } from '../context/smoke-context.js';
import type { ExtensionBucket } from '../plugin-registry.js';
import { emitSmokeEvent } from './events.js';
import { serializeError } from './error-serialization.js';
import type { SerializedSmokeError, SmokeEvent, SmokeEventSink } from '../../events.js';
import type {
    PathRef,
    SmokeContext,
    SmokeResource,
    SmokeStepResult,
    SmokeSuite,
    StepOptions,
} from '../../types.js';

export class SuiteExecutor {
    public readonly steps: SmokeStepResult[] = [];
    public readonly context: SmokeContext;
    public firstContinuedFailure: SerializedSmokeError | undefined;
    public preserveManagedWorkdirs = false;

    private nextStepId = 1;
    private readonly cleanupStack: Array<() => Promise<void> | void> = [];
    private readonly resources: SmokeResource[] = [];
    private readonly trackedResources: WeakSet<SmokeResource> = new WeakSet();
    private readonly managedResources: WeakSet<SmokeResource> = new WeakSet();
    private readonly redactor = new Redactor();
    private currentStepId: string | undefined;

    constructor(
        private readonly suite: SmokeSuite,
        private readonly root: PathRef,
        private readonly extensions: ExtensionBucket,
        private readonly keepWorkdirOnFail: boolean,
        private readonly eventSink: SmokeEventSink | undefined,
    ) {
        this.context = createSmokeContext({
            suite: this.suite,
            root: this.root,
            extensions: this.extensions,
            keepWorkdirOnFail: this.keepWorkdirOnFail,
            preserveManagedWorkdirs: () => this.preserveManagedWorkdirs,
            currentStepId: () => this.currentStepId,
            runStep: async (name, options, fn) => this.runStep(name, options, fn),
            runCommand: async (command, args, options) => this.runContextCommand(command, args, options),
            addCleanup: (fn) => this.cleanupStack.push(fn),
            addResource: (resource) => {
                this.addResource(resource);
            },
            addManagedResource: (resource) => {
                this.addManagedResource(resource);
            },
            addRedaction: (value, options) => {
                this.redactor.add(value, options);
            },
            redactText: (value) => this.redactor.text(value),
            emit: async (event) => this.emit(event),
        });
    }

    public async runCleanup(): Promise<SerializedSmokeError[]> {
        const errors: SerializedSmokeError[] = [];

        for (const cleanup of this.cleanupStack.splice(0).reverse()) {
            try {
                await cleanup();
            } catch (error) {
                errors.push(this.serializeError(error));
            }
        }

        return errors;
    }

    public async attachResourcesOnFailure(): Promise<SerializedSmokeError[]> {
        const errors: SerializedSmokeError[] = [];

        for (const resource of this.resources) {
            if (!resource.attachOnFailure) {
                continue;
            }

            try {
                await resource.attachOnFailure(this.context.attach);
            } catch (error) {
                errors.push(this.serializeError(error));
            }
        }

        return errors;
    }

    public serializeError(error: unknown): SerializedSmokeError {
        return this.redactor.error(serializeError(error));
    }

    private async runStep<T>(name: string, options: StepOptions, fn: () => Promise<T> | T): Promise<T> {
        const stepId = `${this.suite.id}:step-${String(this.nextStepId++)}`;
        const previousStepId = this.currentStepId;
        const startedAt = Date.now();

        await this.emit({
            type: 'step.started',
            suiteId: this.suite.id,
            stepId,
            name,
        });

        this.currentStepId = stepId;

        try {
            const value = await fn();
            const durationMs = Date.now() - startedAt;
            this.steps.push({ id: stepId, name, status: 'passed', durationMs });

            await this.emit({
                type: 'step.passed',
                stepId,
                durationMs,
            });

            return value;
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            if (error instanceof SmokeSkipSignal) {
                this.steps.push({ id: stepId, name, status: 'skipped', durationMs, skipReason: error.message });

                await this.emit({
                    type: 'step.skipped',
                    stepId,
                    reason: error.message,
                    durationMs,
                });

                throw error;
            }

            const serialized = this.serializeError(error);
            this.steps.push({ id: stepId, name, status: 'failed', durationMs, error: serialized });

            await this.emit({
                type: 'step.failed',
                stepId,
                error: serialized,
                durationMs,
            });

            if (options.continueOnFailure) {
                this.firstContinuedFailure ??= serialized;
                return undefined as T;
            }

            throw error;
        } finally {
            this.currentStepId = previousStepId;
        }
    }

    private async runContextCommand(
        command: string,
        args: string[],
        options: RunCommandInput['options'],
    ): Promise<Awaited<ReturnType<typeof runCommand>>> {
        const input: RunCommandInput = {
            command,
            args,
            repoRoot: this.root,
        };

        if (options) {
            input.options = options;
        }
        if (this.currentStepId) {
            input.stepId = this.currentStepId;
        }
        if (this.eventSink) {
            input.eventSink = this.redactingEventSink();
        }

        return runCommand(input);
    }

    private redactingEventSink(): SmokeEventSink {
        return {
            emit: async (event) => this.emit(event),
        };
    }

    private addResource(resource: SmokeResource): void {
        if (this.trackedResources.has(resource)) {
            return;
        }

        this.trackedResources.add(resource);
        this.resources.push(resource);
    }

    private addManagedResource(resource: SmokeResource): void {
        this.addResource(resource);
        if (this.managedResources.has(resource)) {
            return;
        }

        this.managedResources.add(resource);
        this.cleanupStack.push(async () => resource.cleanup());
    }

    private async emit(event: SmokeEvent): Promise<void> {
        await emitSmokeEvent(this.eventSink, this.redactor.event(event));
    }
}
