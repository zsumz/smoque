import { SmokeError } from '../../errors.js';
import { setSnapshotUpdateMode } from '../../expectations.js';
import { toPathRef } from '../../path-ref.js';
import { SmokeSkipSignal } from '../context/skip-signal.js';
import type { ExtensionBucket } from '../plugin-registry.js';
import type { RegisteredSuite, SmokeRegistry } from '../registry.js';
import { emitSmokeEvent } from './events.js';
import { serializeError } from './error-serialization.js';
import { SuiteExecutor } from './suite-executor.js';
import { filterSuites, type SuiteFilterOptions } from './suite-filter.js';
import type { SerializedSmokeError, SmokeEventSink } from '../../events.js';
import type { PathRef, SmokeRunOptions, SmokeRunResult, SmokeSuiteResult } from '../../types.js';

export async function runRegisteredSuitesForRegistry(
    registry: SmokeRegistry,
    options: SmokeRunOptions = {},
): Promise<SmokeRunResult> {
    await registry.ready();
    setSnapshotUpdateMode(options.updateSnapshots ?? false);

    try {
        const definitions = registry.getDefinitions();
        const runId = options.runId ?? `run-${String(Date.now())}`;
        const startedAt = Date.now();
        const eventSink = options.eventSink;
        const repoRoot = toPathRef(options.repoRoot ?? process.cwd());

        await emitSmokeEvent(eventSink, {
            type: 'run.started',
            runId,
            startedAt: new Date(startedAt).toISOString(),
        });

        const suiteFilterOptions: SuiteFilterOptions = {};
        if (options.suiteIds !== undefined) {
            suiteFilterOptions.suiteIds = options.suiteIds;
        }
        if (options.tags !== undefined) {
            suiteFilterOptions.tags = options.tags;
        }
        if (options.skipTags !== undefined) {
            suiteFilterOptions.skipTags = options.skipTags;
        }

        const selectedDefinitions = filterSuites(definitions, suiteFilterOptions);
        if (definitions.length > 0 && selectedDefinitions.length === 0) {
            throw new SmokeError('No smoke suites matched the selected filters.', {
                suiteIds: options.suiteIds ?? [],
                tags: options.tags ?? [],
                skipTags: options.skipTags ?? [],
            });
        }

        for (const definition of selectedDefinitions) {
            await emitSmokeEvent(eventSink, {
                type: 'suite.discovered',
                suiteId: definition.suite.id,
                name: definition.suite.name,
                file: definition.suite.file ?? '<unknown>',
                tags: definition.suite.tags,
            });
        }

        const suites: SmokeSuiteResult[] = [];

        for (const definition of selectedDefinitions) {
            suites.push(
                await runSuite(definition, repoRoot, registry.getExtensions(), options.keepWorkdirOnFail ?? false, eventSink),
            );
        }

        const durationMs = Date.now() - startedAt;
        const status = suites.some((suite) => suite.status === 'failed') ? 'failed' : 'passed';

        await emitSmokeEvent(eventSink, {
            type: 'run.finished',
            status,
            durationMs,
        });

        return {
            runId,
            status,
            suites,
            durationMs,
        };
    } finally {
        setSnapshotUpdateMode(false);
    }
}

async function runSuite(
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
        executor = new SuiteExecutor(definition.suite, repoRoot, extensions, keepWorkdirOnFail, eventSink);

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
    if (executor) {
        executor.preserveManagedWorkdirs = primaryError !== undefined || continuedFailure !== undefined;
    }
    const attachErrors = executor && (primaryError || continuedFailure) ? await executor.attachResourcesOnFailure() : [];
    const cleanupErrors = executor ? [...attachErrors, ...await executor.runCleanup()] : [];
    const durationMs = Date.now() - startedAt;
    const status =
        primaryError || continuedFailure || cleanupErrors.length > 0
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
    if (error) {
        result.error = error;
    }

    return result;
}
