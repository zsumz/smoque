import ts from 'typescript';

export function runtimeModuleSpecifier(statement: ts.Statement): string | undefined {
    if (ts.isImportDeclaration(statement)) {
        if (!hasLiteralModuleSpecifier(statement) || isTypeOnlyImport(statement)) {
            return undefined;
        }
        return statement.moduleSpecifier.text;
    }
    if (ts.isExportDeclaration(statement)) {
        if (!hasLiteralModuleSpecifier(statement) || isTypeOnlyExport(statement)) {
            return undefined;
        }
        return statement.moduleSpecifier.text;
    }
    return undefined;
}

function hasLiteralModuleSpecifier(
    statement: ts.ImportDeclaration | ts.ExportDeclaration,
): statement is (ts.ImportDeclaration | ts.ExportDeclaration) & {
    moduleSpecifier: ts.StringLiteral;
} {
    return statement.moduleSpecifier !== undefined
        && ts.isStringLiteral(statement.moduleSpecifier);
}

function isTypeOnlyImport(statement: ts.ImportDeclaration): boolean {
    const clause = statement.importClause;
    if (clause === undefined) {
        return false;
    }
    if (clause.phaseModifier !== undefined) {
        return true;
    }
    if (clause.name !== undefined || clause.namedBindings === undefined) {
        return false;
    }
    return ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly);
}

function isTypeOnlyExport(statement: ts.ExportDeclaration): boolean {
    if (statement.isTypeOnly) {
        return true;
    }
    return statement.exportClause !== undefined
        && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.every((specifier) => specifier.isTypeOnly);
}
