import ts from 'typescript';
export { sourceFacades } from './facade-policy.mts';

export function isPureReExportFacade(sourceFile: ts.SourceFile): boolean {
    return sourceFile.statements.length > 0
        && sourceFile.statements.every((statement) =>
            ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined);
}
