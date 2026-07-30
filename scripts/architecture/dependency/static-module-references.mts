import ts from 'typescript';
import {
    isDynamicImportCall,
    literalDynamicImportSpecifier,
    literalImportEqualsSpecifier,
    literalImportTypeSpecifier,
} from './static-module-specifiers.mts';

export interface StaticModuleReference {
    kind: 'import' | 'export' | 'import-equals' | 'import-type' | 'dynamic-import';
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
        if (ts.isImportEqualsDeclaration(node)) {
            const importEqualsSpecifier = literalImportEqualsSpecifier(node);
            if (importEqualsSpecifier !== undefined) {
                references.push({
                    kind: 'import-equals',
                    node,
                    specifier: importEqualsSpecifier.text,
                    typeOnly: node.isTypeOnly,
                });
                return;
            }
        }
        const importTypeSpecifier = literalImportTypeSpecifier(node);
        if (importTypeSpecifier !== undefined) {
            references.push({
                kind: 'import-type',
                node,
                specifier: importTypeSpecifier.text,
                typeOnly: true,
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

export function collectNonliteralDynamicImports(
    sourceFile: ts.SourceFile,
): ts.CallExpression[] {
    const imports: ts.CallExpression[] = [];

    function visit(node: ts.Node): void {
        if (
            isDynamicImportCall(node)
            && literalDynamicImportSpecifier(node) === undefined
        ) {
            imports.push(node);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return imports;
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
