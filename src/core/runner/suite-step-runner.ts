import type { SerializedSmokeError, SmokeEvent } from '../../events.js';
import type { SmokeStepResult, StepOptions } from '../../types/suite.js';
import { SmokeSkipSignal } from '../context/skip-signal.js';

type EventEmitter = (event: SmokeEvent) => Promise<void>;
type ErrorSerializer = (error: unknown) => SerializedSmokeError;

export class SuiteStepRunner {
    public readonly steps: SmokeStepResult[] = [];
    public firstContinuedFailure: SerializedSmokeError | undefined;
    public currentStepId: string | undefined;

    private nextStepId = 1;

    constructor(
        private readonly suiteId: string,
        private readonly emit: EventEmitter,
        private readonly serializeError: ErrorSerializer,
    ) {}

    public async run<T>(
        name: string,
        options: StepOptions,
        fn: () => Promise<T> | T,
    ): Promise<T> {
        const stepId = `${this.suiteId}:step-${String(this.nextStepId++)}`;
        const previousStepId = this.currentStepId;
        const startedAt = Date.now();

        await this.emit({
            type: 'step.started',
            suiteId: this.suiteId,
            stepId,
            name,
        });
        this.currentStepId = stepId;

        try {
            const value = await fn();
            const durationMs = Date.now() - startedAt;
            this.steps.push({ id: stepId, name, status: 'passed', durationMs });
            await this.emit({ type: 'step.passed', stepId, durationMs });
            return value;
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            if (error instanceof SmokeSkipSignal) {
                this.steps.push({
                    id: stepId,
                    name,
                    status: 'skipped',
                    durationMs,
                    skipReason: error.message,
                });
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
            await this.emit({ type: 'step.failed', stepId, error: serialized, durationMs });

            if (options.continueOnFailure) {
                this.firstContinuedFailure ??= serialized;
                return undefined as T;
            }
            throw error;
        } finally {
            this.currentStepId = previousStepId;
        }
    }
}
