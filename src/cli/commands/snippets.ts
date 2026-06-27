import { relative } from 'node:path';

import { parseDuration } from '../../duration.js';
import type { DurationString } from '../../types.js';
import { parseSnippetOptions } from '../args/options.js';
import { discoverMarkdownFiles } from '../discovery/markdown-files.js';
import { normalizePath } from '../path.js';
import { extractMarkdownSnippets, type MarkdownSnippet } from '../snippets/markdown-snippets.js';
import { runSnippet } from '../snippets/run-snippet.js';

const defaultSnippetTimeout: DurationString = '30s';

export async function snippetsCommand(args: string[]): Promise<number> {
    const options = parseSnippetOptions(args);
    const repoRoot = process.cwd();
    const timeout = options.timeout ?? defaultSnippetTimeout;
    const timeoutMs = parseDuration(timeout, 30_000);
    const markdownFiles = await discoverMarkdownFiles(repoRoot, options.pattern);
    const snippets = (await Promise.all(markdownFiles.map(async (file) => extractMarkdownSnippets(file)))).flat();

    if (snippets.length === 0) {
        console.error(
            options.pattern
                ? `No marked smoque snippets found in: ${options.pattern}`
                : 'No marked smoque snippets found.',
        );
        return 2;
    }

    console.log('smoque snippets');
    let failed = false;

    for (const snippet of snippets) {
        const result = await runSnippet(snippet, { timeoutMs, timeoutLabel: timeout });
        const passed = snippet.expectedFailure ? result.exitCode !== 0 : result.exitCode === 0;
        const label = snippetLabel(repoRoot, snippet);

        if (passed) {
            console.log(`PASS ${label}${snippet.expectedFailure ? ' (expected failure)' : ''}`);
            continue;
        }

        failed = true;
        console.log(`FAIL ${label}${snippet.expectedFailure ? ' (expected failure passed)' : ''}`);
        console.log(`Source: ${label}`);
        if (result.stdout.trim()) {
            console.log('stdout:');
            console.log(boundedOutput(result.stdout));
        }
        if (result.stderr.trim()) {
            console.log('stderr:');
            console.log(boundedOutput(result.stderr));
        }
    }

    const plural = snippets.length === 1 ? '' : 's';
    console.log(`Result: ${failed ? 'failed' : 'passed'} ${String(snippets.length)} snippet${plural}`);
    return failed ? 1 : 0;
}

function snippetLabel(repoRoot: string, snippet: MarkdownSnippet): string {
    return `${normalizePath(relative(repoRoot, snippet.sourceFile))} > ${snippet.heading} > line ${String(snippet.startLine)}`;
}

function boundedOutput(value: string): string {
    return value.length <= 2_000 ? value.trimEnd() : `${value.slice(0, 2_000).trimEnd()}\n... truncated ...`;
}
