import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque run discovers smoke files and writes terminal, JSON, and JUnit output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'package.smoke.ts'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("cli package smoke", async (t) => {
          const stepName: string = "passes";
          await t.step(stepName, () => undefined);
        });
      `,
            'utf8',
        );

        const result = await runCli(
            ['run', '--json', 'smoke-report.json', '--junit', 'smoke-report.xml'],
            root,
        );

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.match(result.stdout, /smoque/u);
        assert.match(result.stdout, /cli package smoke/u);
        assert.match(result.stdout, /PASS passes/u);

        const json = JSON.parse(await readFile(join(root, 'smoke-report.json'), 'utf8')) as {
            run: { status: string };
            suites: Array<{ name: string }>;
        };
        assert.equal(json.run.status, 'passed');
        const [suite] = json.suites;
        assert.equal(suite?.name, 'cli package smoke');

        const junit = await readFile(join(root, 'smoke-report.xml'), 'utf8');
        assert.match(junit, /<testsuite name="cli package smoke" tests="1" failures="0" skipped="0"/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
