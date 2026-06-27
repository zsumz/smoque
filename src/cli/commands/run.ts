import { resolve } from 'node:path';

import {
    createGitHubReporter,
    createJUnitReporter,
    createJsonReporter,
    createTerminalReporter,
    getRegisteredSuites,
    runRegisteredSuites,
    type SmokeEvent,
    type SmokeEventSink,
} from '../../core.js';
import { parseRunOptions } from '../args/options.js';
import { discoverSmokeFiles, importSmokeFiles, isPathLikeSmokePattern } from '../discovery/smoke-files.js';
import { noSuiteMatchMessage, selectSuites, tagOnlySelectionOptions } from '../selection/suite-selector.js';

export async function runCommand(args: string[]): Promise<number> {
    const options = parseRunOptions(args);
    const repoRoot = process.cwd();
    let files: string[];
    let selectionOptions = options;

    if (options.pattern === undefined) {
        files = await discoverSmokeFiles(repoRoot);
    } else {
        const pathMatchedFiles = await discoverSmokeFiles(repoRoot, options.pattern);
        if (pathMatchedFiles.length > 0) {
            files = pathMatchedFiles;
            selectionOptions = tagOnlySelectionOptions(options);
        } else if (isPathLikeSmokePattern(options.pattern)) {
            console.error(`No smoke files matched: ${options.pattern}`);
            return 2;
        } else {
            files = await discoverSmokeFiles(repoRoot);
        }
    }

    if (files.length === 0) {
        console.error('No smoke files found.');
        return 2;
    }

    await importSmokeFiles(files);

    const suites = selectSuites(getRegisteredSuites(), repoRoot, selectionOptions);
    if (suites.length === 0) {
        console.error(noSuiteMatchMessage(options));
        return 2;
    }

    const reporters: SmokeEventSink[] = [createTerminalReporter()];
    if (options.ci) {
        reporters.push(createGitHubReporter());
    }
    if (options.json) {
        reporters.push(createJsonReporter({ path: resolve(repoRoot, options.json) }));
    }
    if (options.junit) {
        reporters.push(createJUnitReporter({ path: resolve(repoRoot, options.junit) }));
    }

    const runOptions = {
        repoRoot,
        eventSink: combineReporters(reporters),
        suiteIds: suites.map((suite) => suite.id),
    };
    if (options.keepWorkdirOnFail !== undefined) {
        Object.assign(runOptions, { keepWorkdirOnFail: options.keepWorkdirOnFail });
    }
    if (options.updateSnapshots !== undefined) {
        Object.assign(runOptions, { updateSnapshots: options.updateSnapshots });
    }

    const result = await runRegisteredSuites(runOptions);

    return result.status === 'passed' ? 0 : 1;
}

function combineReporters(reporters: SmokeEventSink[]): SmokeEventSink {
    return {
        async emit(event: SmokeEvent): Promise<void> {
            await Promise.all(reporters.map(async (reporter) => reporter.emit(event)));
        },
    };
}
