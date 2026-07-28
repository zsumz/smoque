import ts from 'typescript';

const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
});
const typeFormatFlags = ts.TypeFormatFlags.NoTruncation
    | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

export function resolveApiSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
    return (symbol.flags & ts.SymbolFlags.Alias) === 0
        ? symbol
        : checker.getAliasedSymbol(symbol);
}

export function formatApiSymbol(
    exportName: string,
    symbol: ts.Symbol,
    checker: ts.TypeChecker,
): string {
    const declarations = symbol.declarations ?? [];
    const typeDeclarations = declarations.filter(isTypeDeclaration);
    if (typeDeclarations.length > 0) {
        return typeDeclarations
            .map((declaration) => printer.printNode(
                ts.EmitHint.Unspecified,
                declaration,
                declaration.getSourceFile(),
            ))
            .join('\n');
    }

    const declaration = symbol.valueDeclaration ?? declarations[0];
    if (declaration === undefined) {
        return `export const ${exportName}: unknown;`;
    }
    const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
    if (signatures.length > 0 && (symbol.flags & ts.SymbolFlags.Function) !== 0) {
        return signatures
            .map((signature) => `export function ${exportName}${checker.signatureToString(
                signature,
                declaration,
                typeFormatFlags,
            )};`)
            .join('\n');
    }
    return `export const ${exportName}: ${checker.typeToString(
        type,
        declaration,
        typeFormatFlags,
    )};`;
}

export function referencedApiSymbols(
    symbol: ts.Symbol,
    checker: ts.TypeChecker,
    sourceRoot: string,
): ts.Symbol[] {
    const referenced: Set<ts.Symbol> = new Set();
    const addReference = (node: ts.Node): void => {
        const candidate = checker.getSymbolAtLocation(node);
        if (candidate === undefined) {
            return;
        }
        const resolved = resolveApiSymbol(candidate, checker);
        if (isOwnedTopLevelSymbol(resolved, sourceRoot)) {
            referenced.add(resolved);
        }
    };
    const visit = (node: ts.Node): void => {
        if (ts.isTypeReferenceNode(node)) {
            addReference(node.typeName);
        } else if (ts.isExpressionWithTypeArguments(node)) {
            addReference(node.expression);
        } else if (ts.isTypeQueryNode(node)) {
            addReference(node.exprName);
        }
        if (ts.isFunctionLike(node)) {
            node.typeParameters?.forEach(visit);
            node.parameters.forEach(visit);
            if (node.type !== undefined) {
                visit(node.type);
            }
            return;
        }
        ts.forEachChild(node, visit);
    };
    for (const declaration of symbol.declarations ?? []) {
        visit(declaration);
    }
    return [...referenced];
}

function isTypeDeclaration(node: ts.Declaration): node is ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration
    | ts.ClassDeclaration
    | ts.EnumDeclaration {
    return ts.isInterfaceDeclaration(node)
        || ts.isTypeAliasDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isEnumDeclaration(node);
}

function isOwnedTopLevelSymbol(symbol: ts.Symbol, sourceRoot: string): boolean {
    return (symbol.declarations ?? []).some((declaration) => {
        const file = declaration.getSourceFile().fileName;
        return file.startsWith(sourceRoot)
            && (ts.isInterfaceDeclaration(declaration)
                || ts.isTypeAliasDeclaration(declaration)
                || ts.isClassDeclaration(declaration)
                || ts.isEnumDeclaration(declaration));
    });
}
