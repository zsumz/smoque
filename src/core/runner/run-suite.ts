import type { SerializedSmokeError, SmokeEventSink } from '../../events.js';
import type { PathRef } from '../../types/path-ref.js';
import type { SmokeSuiteResult } from '../../types/suite.js';
import { SmokeSkipSignal } from '../context/skip-signal.js';
import type { ExtensionBucket } from '../plugin-registry.js';
import type { RegisteredSuite } from '../registry.js';
import { serializeError } from './error-serialization.js';
import { emitSmokeEvent } from './events.js';
import { SuiteExecutor } from './suite-executor.js';

export async function runSuite(
    definition: RegisteredSuite,
    repoRoot: PathRef,
    extensions: ExtensionBucket,
    keepWorkdirOnFail: boolean,
    eventSink: SmokeEventSink | undefined,
): Promise<SmokeSuiteResult> {
    const startedAt = Date.now();

    await emitSmokeEvent(eventSink, {
        type: 'suite.started',
        suiteId: definition.suite.id,
        name: definition.suite.name,
    });

    let primaryError: SerializedSmokeError | undefined;
    let skipped = false;
    let executor: SuiteExecutor | undefined;

    try {
        executor = new SuiteExecutor(
            definition.suite,
            repoRoot,
            extensions,
            keepWorkdirOnFail,
            eventSink,
        );
        if (definition.options.skip) {
            skipped = true;
        } else {
            await definition.fn(executor.context);
        }
    } catch (error) {
        if (error instanceof SmokeSkipSignal) {
            skipped = true;
        } else {
            primaryError = executor ? executor.serializeError(error) : serializeError(error);
        }
    }

    const continuedFailure = executor?.firstContinuedFailure;
    if (executor !== undefined) {
        executor.preserveManagedWorkdirs =
            primaryError !== undefined || continuedFailure !== undefined;
    }
    const attachErrors = executor !== undefined
        && (primaryError !== undefined || continuedFailure !== undefined)
        ? await executor.attachResourcesOnFailure()
        : [];
    const cleanupErrors = executor === undefined
        ? []
        : [...attachErrors, ...await executor.runCleanup()];
    const durationMs = Date.now() - startedAt;
    const status =
        primaryError !== undefined
        || continuedFailure !== undefined
        || cleanupErrors.length > 0
            ? 'failed'
            : skipped
                ? 'skipped'
                : 'passed';

    await emitSmokeEvent(eventSink, {
        type: 'suite.finished',
        suiteId: definition.suite.id,
        status,
        durationMs,
    });

    const result: SmokeSuiteResult = {
        suite: definition.suite,
        status,
        steps: executor?.steps ?? [],
        durationMs,
        cleanupErrors,
    };
    const error = primaryError ?? continuedFailure;
    if (error !== undefined) {
        result.error = error;
    }
    return result;
}
