import type ts from 'typescript';
import {
    collectStaticModuleReferences,
} from '../dependency/static-module-references.mts';
import {
    facadeImportFailure,
} from './facade-policy.mts';
import { layerImportFailure } from './layer-import-policy.mts';
import { relativePath } from './module-files.mts';
import { resolveImportedSourceModule } from './source-module-target.mts';

export function inspectSourceImports(
    root: string,
    sourceRoot: string,
    file: string,
    sourceFile: ts.SourceFile,
): string[] {
    const failures: string[] = [];
    const relativeSource = relativePath(root, file);

    for (const reference of collectStaticModuleReferences(sourceFile)) {
        const target = resolveImportedSourceModule(
            sourceRoot,
            file,
            reference.specifier,
        );
        const relativeTarget = target === undefined ? undefined : relativePath(root, target);
        if (relativeTarget === undefined) {
            continue;
        }
        const start = sourceFile.getLineAndCharacterOfPosition(
            reference.node.getStart(sourceFile),
        );
        const prefix = `${relativeSource}:${String(start.line + 1)}:`
            + `${String(start.character + 1)} `;
        const facadeFailure = facadeImportFailure(
            relativeSource,
            relativeTarget,
            start.line + 1,
            start.character + 1,
        );
        if (facadeFailure !== undefined) {
            failures.push(facadeFailure);
        }
        const layerFailure = layerImportFailure(relativeSource, relativeTarget);
        if (layerFailure !== undefined) {
            failures.push(prefix + layerFailure);
        }
    }
    return failures;
}
