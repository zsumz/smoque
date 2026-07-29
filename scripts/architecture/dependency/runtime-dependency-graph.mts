import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { relativePath } from '../module/module-files.mts';
import { collectStaticModuleReferences } from './static-module-references.mts';

export async function createRuntimeDependencyGraph(
    root: string,
    sourceRoot: string,
    files: readonly string[],
): Promise<ReadonlyMap<string, readonly string[]>> {
    const sourceFiles = new Set(files.map((file) => path.resolve(file)));
    const graph: Map<string, readonly string[]> = new Map();

    for (const file of [...files].sort()) {
        const source = await readFile(file, 'utf8');
        const sourceFile = ts.createSourceFile(
            file,
            source,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        );
        const dependencies = collectStaticModuleReferences(sourceFile)
            .filter((reference) => !reference.typeOnly)
            .map((reference) => resolveSourceModule(
                sourceRoot,
                file,
                reference.specifier,
            ))
            .filter((target): target is string => target !== undefined && sourceFiles.has(target))
            .map((target) => relativePath(root, target));
        graph.set(relativePath(root, file), [...new Set(dependencies)].sort());
    }
    return graph;
}

function resolveSourceModule(
    sourceRoot: string,
    source: string,
    specifier: string,
): string | undefined {
    if (!specifier.startsWith('.')) {
        return undefined;
    }
    const target = path.resolve(path.dirname(source), specifier.replace(/\.js$/u, '.ts'));
    return target.startsWith(`${sourceRoot}${path.sep}`) ? target : undefined;
}
