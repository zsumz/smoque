import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque run accepts mixed comma-separated tags', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-comma-tags-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'tagged.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, async (t) => {
          await t.step("selected package", () => undefined);
        });
        smoke.suite("service smoke", { tags: ["service"] }, async (t) => {
          await t.step("selected service", () => undefined);
        });
        smoke.suite("slow smoke", { tags: ["slow"] }, () => {
          throw new Error("slow suite should be skipped");
        });
      `,
            'utf8',
        );

        const result = await runCli(
            ['run', 'smoke/tagged.smoke.mjs', '--tag', 'package, service', '--skip-tag', 'slow'],
            root,
        );

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /PASS selected package/u);
        assert.match(result.stdout, /PASS selected service/u);
        assert.doesNotMatch(result.stdout, /slow suite should be skipped/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque run reports no tag matches clearly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-no-tags-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'tagged.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['run', '--tag', 'missing'], root);

        assert.equal(result.exitCode, 2, cliResultSummary(result));
        assert.match(result.stderr, /No smoke suites matched the selected tag filters\./u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque list reports no tag matches clearly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-no-tags-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'tagged.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['list', '--tag', 'missing'], root);

        assert.equal(result.exitCode, 2, cliResultSummary(result));
        assert.match(result.stderr, /No smoke suites matched the selected tag filters\./u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
