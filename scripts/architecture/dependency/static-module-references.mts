import ts from 'typescript';

export interface StaticModuleReference {
    kind: 'import' | 'export' | 'dynamic-import';
    node: ts.Node;
    specifier: string;
    typeOnly: boolean;
}

export function collectStaticModuleReferences(
    sourceFile: ts.SourceFile,
): StaticModuleReference[] {
    const references: StaticModuleReference[] = [];

    function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) && hasLiteralModuleSpecifier(node)) {
            references.push({
                kind: 'import',
                node,
                specifier: node.moduleSpecifier.text,
                typeOnly: isTypeOnlyImport(node),
            });
            return;
        }
        if (ts.isExportDeclaration(node) && hasLiteralModuleSpecifier(node)) {
            references.push({
                kind: 'export',
                node,
                specifier: node.moduleSpecifier.text,
                typeOnly: isTypeOnlyExport(node),
            });
            return;
        }
        const dynamicSpecifier = literalDynamicImportSpecifier(node);
        if (dynamicSpecifier !== undefined) {
            references.push({
                kind: 'dynamic-import',
                node,
                specifier: dynamicSpecifier.text,
                typeOnly: false,
            });
            return;
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return references;
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
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) {
        return true;
    }
    if (
        clause.name !== undefined
        || clause.namedBindings === undefined
        || !ts.isNamedImports(clause.namedBindings)
    ) {
        return false;
    }
    return clause.namedBindings.elements.length > 0
        && clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly);
}

function isTypeOnlyExport(statement: ts.ExportDeclaration): boolean {
    if (statement.isTypeOnly) {
        return true;
    }
    return statement.exportClause !== undefined
        && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.length > 0
        && statement.exportClause.elements.every((specifier) => specifier.isTypeOnly);
}

function literalDynamicImportSpecifier(
    node: ts.Node,
): ts.StringLiteral | undefined {
    if (
        !ts.isCallExpression(node)
        || node.expression.kind !== ts.SyntaxKind.ImportKeyword
        || node.arguments.length !== 1
    ) {
        return undefined;
    }
    const specifier = node.arguments[0];
    return specifier !== undefined && ts.isStringLiteral(specifier)
        ? specifier
        : undefined;
}
