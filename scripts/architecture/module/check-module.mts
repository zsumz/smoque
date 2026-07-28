import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { inspectModuleLayout } from './module-layout.mts';
import { relativePath } from './module-files.mts';
import { sourceFacades } from './facade-policy.mts';
import {
    isPureReExportFacade,
} from './source-facades.mts';
import { inspectSourceImports } from './source-import-boundaries.mts';
import { inspectSourceSafety } from './source-safety.mts';

export async function checkModule(
    root: string,
    sourceRoot: string,
    file: string,
): Promise<string[]> {
    const source = await readFile(file, 'utf8');
    const relative = relativePath(root, file);
    const failures = inspectModuleLayout(relative, countLines(source));
    if (!relative.startsWith('src/')) {
        return failures;
    }

    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    if (sourceFacades.has(relative) && !isPureReExportFacade(sourceFile)) {
        failures.push(`${relative}: facade modules must contain only re-exports.`);
    }
    failures.push(...inspectSourceImports(root, sourceRoot, file, sourceFile));
    failures.push(...inspectSourceSafety(root, file, sourceFile));
    return failures;
}

function countLines(source: string): number {
    return source === ''
        ? 0
        : source.split(/\r?\n/u).length - (source.endsWith('\n') ? 1 : 0);
}
