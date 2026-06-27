import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { runProcess, type ProcessResult } from '../process.js';
import type { MarkdownSnippet } from './markdown-snippets.js';

export interface RunSnippetOptions {
    timeoutMs: number;
    timeoutLabel: string;
}

export async function runSnippet(snippet: MarkdownSnippet, options: RunSnippetOptions): Promise<ProcessResult> {
    const root = await mkdtemp(join(tmpdir(), 'smoque-snippet-'));
    try {
        if (snippet.fixture) {
            await cp(resolve(dirname(snippet.sourceFile), snippet.fixture), root, { recursive: true });
        }

        const snippetDir = resolve(root, '.smoque-snippets');
        await mkdir(snippetDir, { recursive: true });
        const extension = snippet.language === 'js' ? 'mjs' : 'ts';
        const smokeFile = resolve(snippetDir, `snippet-${String(snippet.index)}.smoke.${extension}`);
        await writeFile(smokeFile, snippet.code, 'utf8');

        const mainPath = fileURLToPath(new URL('../main.js', import.meta.url));
        return await runProcess(process.execPath, [mainPath, 'run', smokeFile], root, {
            timeoutMs: options.timeoutMs,
            timeoutLabel: options.timeoutLabel,
        });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}
