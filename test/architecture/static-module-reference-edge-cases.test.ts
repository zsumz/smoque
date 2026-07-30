import assert from 'node:assert/strict';
import ts from 'typescript';
import { test } from 'vitest';

import {
    collectNonliteralDynamicImports,
    collectStaticModuleReferences,
} from '../../scripts/architecture/dependency/static-module-references.mts';
import {
    inspectSourceImports,
} from '../../scripts/architecture/module/source-import-boundaries.mts';

test('static string forms and import-equals dependencies are classified', () => {
    const references = collectStaticModuleReferences(parse(`
        type Client = import(\`../plugins/http.js\`).HttpApi;
        void import(\`../plugins/node.js\`, { with: {} });
        import client = require("../plugins/http.js");
    `));

    assert.deepEqual(
        references.map(({ kind, specifier, typeOnly }) => ({
            kind,
            specifier,
            typeOnly,
        })),
        [
            {
                kind: 'import-type',
                specifier: '../plugins/http.js',
                typeOnly: true,
            },
            {
                kind: 'dynamic-import',
                specifier: '../plugins/node.js',
                typeOnly: false,
            },
            {
                kind: 'import-equals',
                specifier: '../plugins/http.js',
                typeOnly: false,
            },
        ],
    );
});

test('layer boundaries inspect every static string dependency form', () => {
    const failures = inspectSourceImports(
        '/workspace',
        '/workspace/src',
        '/workspace/src/reporting/report.ts',
        parse(`
            type Client = import(\`../plugins/http.js\`).HttpApi;
            void import(\`../plugins/node.js\`, { with: {} });
            import client = require("../plugins/http.js");
        `),
    );

    assert.deepEqual(failures, [
        'src/reporting/report.ts:2:27 reporting modules must not import the plugins layer.',
        'src/reporting/report.ts:3:18 reporting modules must not import the plugins layer.',
        'src/reporting/report.ts:4:13 reporting modules must not import the plugins layer.',
    ]);
});

test('nonliteral dynamic imports fail closed in source modules', () => {
    const sourceFile = parse(`
        const moduleName = "../plugins/http.js";
        void import(moduleName);
    `);

    assert.equal(collectNonliteralDynamicImports(sourceFile).length, 1);
    assert.deepEqual(
        inspectSourceImports(
            '/workspace',
            '/workspace/src',
            '/workspace/src/core/runtime.ts',
            sourceFile,
        ),
        [
            'src/core/runtime.ts:3:14 source modules must use literal dynamic import specifiers.',
        ],
    );
});

test('the discovered smoke-file loader is the only nonliteral import boundary', () => {
    const failures = inspectSourceImports(
        '/workspace',
        '/workspace/src',
        '/workspace/src/cli/discovery/smoke-files.ts',
        parse('void import(discoveredUrl);'),
    );

    assert.deepEqual(failures, []);
});

function parse(source: string): ts.SourceFile {
    return ts.createSourceFile(
        'fixture.ts',
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
}
