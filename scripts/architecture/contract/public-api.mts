import path from 'node:path';
import ts from 'typescript';
import { expectedPublicExports } from './public-export-manifest.mts';

export function inspectPublicApi(root: string): string[] {
    const configPath = path.join(root, 'tsconfig.base.json');
    const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
    if (config.error !== undefined) {
        return [formatDiagnostic(config.error)];
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    if (parsed.errors.length > 0) {
        return parsed.errors.map(formatDiagnostic);
    }

    const sourcePaths = Object.keys(expectedPublicExports);
    const program = ts.createProgram({
        rootNames: sourcePaths.map((sourcePath) => path.join(root, sourcePath)),
        options: { ...parsed.options, noEmit: true },
    });
    const checker = program.getTypeChecker();
    const failures: string[] = [];

    for (const sourcePath of sourcePaths) {
        const sourceFile = program.getSourceFile(path.join(root, sourcePath));
        const moduleSymbol = sourceFile === undefined
            ? undefined
            : checker.getSymbolAtLocation(sourceFile);
        if (moduleSymbol === undefined) {
            failures.push(`${sourcePath}: public entrypoint could not be inspected.`);
            continue;
        }

        const actual = checker.getExportsOfModule(moduleSymbol)
            .map((symbol) => symbol.name)
            .sort();
        const expected = [...expectedPublicExports[sourcePath] ?? []].sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            failures.push([
                `${sourcePath}: public exports changed.`,
                `  expected: ${expected.join(', ')}`,
                `  actual:   ${actual.join(', ')}`,
            ].join('\n'));
        }
    }
    return failures;
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}
