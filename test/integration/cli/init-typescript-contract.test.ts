import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

import { cliResultSummary, runCli } from './cli-harness.js';

const tscPath = fileURLToPath(
    new URL('../../../node_modules/typescript/bin/tsc', import.meta.url),
);

test('generated TypeScript contract matches Node runtime resolution and syntax', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-init-typescript-'));

    try {
        const initialized = await runCli(['init'], root);
        assert.equal(initialized.exitCode, 0, cliResultSummary(initialized));

        const smokeFile = join(root, 'smoke', 'project.smoke.ts');
        await writeFile(
            join(root, 'smoke', 'helper.ts'),
            'export interface Helper { value: string }\nexport const value = "ready";\n',
            'utf8',
        );
        await writeFile(
            smokeFile,
            'import { value } from "./helper.ts";\nvoid value;\n',
            'utf8',
        );
        assertTypeScriptResult(root, 0);
        assertNodeResult(root, smokeFile, 0);

        const rejected = [
            {
                source: 'import { value } from "./helper";\nvoid value;\n',
                pattern: /explicit file extensions/u,
            },
            {
                source: 'enum Status { Ready }\nvoid Status.Ready;\n',
                pattern: /erasableSyntaxOnly/u,
            },
            {
                source: 'namespace Runtime { export const value = 1; }\nvoid Runtime.value;\n',
                pattern: /erasableSyntaxOnly/u,
            },
            {
                source: 'class Service { constructor(private port: number) {} }\nvoid Service;\n',
                pattern: /erasableSyntaxOnly/u,
            },
            {
                source: 'import { Helper } from "./helper.ts";\nconst value: Helper = { value: "x" };\n',
                pattern: /type-only import/u,
            },
        ];
        for (const scenario of rejected) {
            await writeFile(smokeFile, scenario.source, 'utf8');
            const output = assertTypeScriptResult(root, 2);
            assert.match(output, scenario.pattern);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

function assertTypeScriptResult(root: string, expectedStatus: number): string {
    const result = spawnSync(
        process.execPath,
        [tscPath, '-p', 'smoke/tsconfig.json'],
        { cwd: root, encoding: 'utf8' },
    );
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(result.status, expectedStatus, output);
    return output;
}

function assertNodeResult(root: string, file: string, expectedStatus: number): void {
    const result = spawnSync(process.execPath, [file], {
        cwd: root,
        encoding: 'utf8',
    });
    assert.equal(result.status, expectedStatus, `${result.stdout}${result.stderr}`);
}
