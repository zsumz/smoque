import ts from 'typescript';
import {
    facadeImportFailure,
} from './facade-policy.mts';
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

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }
        const target = resolveImportedSourceModule(
            sourceRoot,
            file,
            statement.moduleSpecifier.text,
        );
        const relativeTarget = target === undefined ? undefined : relativePath(root, target);
        if (relativeTarget === undefined) {
            continue;
        }
        const start = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
        const failure = facadeImportFailure(
            relativeSource,
            relativeTarget,
            start.line + 1,
            start.character + 1,
        );
        if (failure !== undefined) {
            failures.push(failure);
        }
    }
    return failures;
}
