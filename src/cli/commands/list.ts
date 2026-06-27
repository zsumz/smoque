import { relative } from 'node:path';

import { getRegisteredSuites } from '../../core.js';
import { parseListOptions } from '../args/options.js';
import { discoverSmokeFiles, importSmokeFiles, isPathLikeSmokePattern } from '../discovery/smoke-files.js';
import { normalizePath } from '../path.js';
import { noSuiteMatchMessage, selectSuites, tagOnlySelectionOptions } from '../selection/suite-selector.js';

export async function listCommand(args: string[]): Promise<number> {
    const options = parseListOptions(args);
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

    for (const suite of suites) {
        const file = suite.file ? normalizePath(relative(repoRoot, suite.file)) : '<unknown>';
        console.log(`${suite.name}\t${file}\t${formatTags(suite.tags)}`);
    }

    return 0;
}

function formatTags(tags: string[]): string {
    return tags.length === 0 ? '-' : tags.join(',');
}
