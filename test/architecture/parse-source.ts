import ts from 'typescript';

export function parseSource(source: string): ts.SourceFile {
    return ts.createSourceFile(
        'fixture.ts',
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
}
