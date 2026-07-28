import ts from 'typescript';
import { relativePath } from './module-files.mts';
import {
    sourceSafetyMessage,
    type SourceSafetyIssue,
} from './source-safety-policy.mts';

export function inspectSourceSafety(
    root: string,
    file: string,
    sourceFile: ts.SourceFile,
): string[] {
    const failures: string[] = [];
    const relative = relativePath(root, file);

    function report(node: ts.Node, issue: SourceSafetyIssue): void {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        failures.push(
            `${relative}:${String(start.line + 1)}:${String(start.character + 1)} `
            + sourceSafetyMessage(issue),
        );
    }

    function visit(node: ts.Node): void {
        if (node.kind === ts.SyntaxKind.AnyKeyword) {
            report(node, 'explicit-any');
        }
        if (ts.isNonNullExpression(node)) {
            report(node, 'non-null-assertion');
        }
        if (
            ts.isAsExpression(node)
            && ts.isAsExpression(node.expression)
            && node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
        ) {
            report(node, 'unknown-double-assertion');
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return failures;
}
