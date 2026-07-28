import ts from 'typescript';
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

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }
        const target = resolveTestSourceModule(
            root,
            file,
            statement.moduleSpecifier.text,
        );
        if (target === undefined) {
            continue;
        }
        const failure = testFacadeImportFailure(
            relativePath(root, target),
        );
        if (failure !== undefined) {
            const start = sourceFile.getLineAndCharacterOfPosition(
                statement.getStart(sourceFile),
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
