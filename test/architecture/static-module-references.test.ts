import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    collectStaticModuleReferences,
} from '../../scripts/architecture/dependency/static-module-references.mts';
import {
    inspectSourceImports,
} from '../../scripts/architecture/module/source-import-boundaries.mts';
import {
    inspectTestImports,
} from '../../scripts/architecture/module/test-import-boundaries.mts';
import { parseSource as parse } from './parse-source.js';

test('static references classify imports, re-exports, and dynamic imports', () => {
    const references = collectStaticModuleReferences(parse(`
        import type { SmokeContext } from "../types/context.js";
        export type { SmokeSuite } from "../types/suite.js";
        export { request } from "../plugins/http.js";
        export * from "../plugins/node.js";
        const plugin = import("../plugins/compose.js");
        void plugin;
    `));

    assert.deepEqual(
        references.map(({ kind, specifier, typeOnly }) => ({
            kind,
            specifier,
            typeOnly,
        })),
        [
            {
                kind: 'import',
                specifier: '../types/context.js',
                typeOnly: true,
            },
            {
                kind: 'export',
                specifier: '../types/suite.js',
                typeOnly: true,
            },
            {
                kind: 'export',
                specifier: '../plugins/http.js',
                typeOnly: false,
            },
            {
                kind: 'export',
                specifier: '../plugins/node.js',
                typeOnly: false,
            },
            {
                kind: 'dynamic-import',
                specifier: '../plugins/compose.js',
                typeOnly: false,
            },
        ],
    );
});

test('layer boundaries reject named, star, and dynamic cross-layer references', () => {
    const failures = inspectSourceImports(
        '/workspace',
        '/workspace/src',
        '/workspace/src/reporting/report.ts',
        parse(`
            export { request } from "../plugins/http.js";
            export * from "../plugins/node.js";
            void import("../plugins/compose.js");
        `),
    );

    assert.deepEqual(failures, [
        'src/reporting/report.ts:2:13 reporting modules must not import the plugins layer.',
        'src/reporting/report.ts:3:13 reporting modules must not import the plugins layer.',
        'src/reporting/report.ts:4:18 reporting modules must not import the plugins layer.',
    ]);
});

test('source and test facade rules reject re-exports', () => {
    const sourceFailures = inspectSourceImports(
        '/workspace',
        '/workspace/src',
        '/workspace/src/core/runner.ts',
        parse(`
            export { SmokeContext } from "../types.js";
            export * from "../reporters.js";
        `),
    );
    const testFailures = inspectTestImports(
        '/workspace',
        '/workspace/test/core/facade.test.ts',
        parse(`
            export { SmokeContext } from "../../dist/types.js";
            export * from "../../dist/reporters.js";
        `),
    );

    assert.equal(sourceFailures.length, 2);
    assert.match(sourceFailures[0] ?? '', /concrete owner behind src\/types\.ts/u);
    assert.match(sourceFailures[1] ?? '', /concrete owner behind src\/reporters\.ts/u);
    assert.deepEqual(testFailures, [
        'test/core/facade.test.ts:2:13 tests must import the public entrypoint '
        + 'or concrete owner behind src/types.ts.',
        'test/core/facade.test.ts:3:13 tests must import the public entrypoint '
        + 'or concrete owner behind src/reporters.ts.',
    ]);
});
