import type ts from 'typescript';
import {
    collectStaticModuleReferences,
} from '../dependency/static-module-references.mts';
import { testFacadeImportFailure } from './facade-policy.mts';
import { relativePath } from './module-files.mts';
import { resolveTestSourceModule } from './test-module-target.mts';

export function inspectTestImports(
    root: string,
    file: string,
    sourceFile: ts.SourceFile,
): string[] {
    const failures: string[] = [];
    const relativeSource = relativePath(root, file);

    for (const reference of collectStaticModuleReferences(sourceFile)) {
        const target = resolveTestSourceModule(
            root,
            file,
            reference.specifier,
        );
        if (target === undefined) {
            continue;
        }
        const failure = testFacadeImportFailure(
            relativePath(root, target),
        );
        if (failure !== undefined) {
            const start = sourceFile.getLineAndCharacterOfPosition(
                reference.node.getStart(sourceFile),
            );
            failures.push(
                `${relativeSource}:${String(start.line + 1)}:`
                + `${String(start.character + 1)} `
                + failure,
            );
        }
    }
    return failures;
}
