import ts from 'typescript';

export type StaticString = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;

export function literalImportTypeSpecifier(
    node: ts.Node,
): StaticString | undefined {
    if (!ts.isImportTypeNode(node) || !ts.isLiteralTypeNode(node.argument)) {
        return undefined;
    }
    return isStaticString(node.argument.literal)
        ? node.argument.literal
        : undefined;
}

export function literalDynamicImportSpecifier(
    node: ts.Node,
): StaticString | undefined {
    if (
        !isDynamicImportCall(node)
        || node.arguments.length < 1
        || node.arguments.length > 2
    ) {
        return undefined;
    }
    const specifier = node.arguments[0];
    return specifier !== undefined && isStaticString(specifier)
        ? specifier
        : undefined;
}

export function literalImportEqualsSpecifier(
    node: ts.ImportEqualsDeclaration,
): StaticString | undefined {
    const reference = node.moduleReference;
    return ts.isExternalModuleReference(reference)
        && isStaticString(reference.expression)
        ? reference.expression
        : undefined;
}

export function isDynamicImportCall(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node)
        && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function isStaticString(node: ts.Node): node is StaticString {
    return ts.isStringLiteral(node)
        || ts.isNoSubstitutionTemplateLiteral(node);
}
