import { SmokeError } from '../../errors.js';
import { setSnapshotUpdateMode } from '../../assertions/snapshot/update-mode.js';
import { toPathRef } from '../../path-ref.js';
import type { SmokeRegistry } from '../registry.js';
import { emitSmokeEvent } from './events.js';
import { runSuite } from './run-suite.js';
import { filterSuites, type SuiteFilterOptions } from './suite-filter.js';
import type { SmokeRunOptions, SmokeRunResult, SmokeSuiteResult } from '../../types/suite.js';

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
