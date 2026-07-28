import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque list filters suites by tag', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-tags-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'tagged.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, () => undefined);
        smoke.suite("slow package smoke", { tags: ["package", "slow"] }, () => undefined);
        smoke.suite("service smoke", { tags: ["service"] }, () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['list', '--tag', 'package', '--skip-tag', 'slow'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /^package smoke\tsmoke\/tagged\.smoke\.mjs\tpackage$/mu);
        assert.doesNotMatch(result.stdout, /slow package smoke/u);
        assert.doesNotMatch(result.stdout, /service smoke/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque run matches suite name fragments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-name-fragment-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'project.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("billing checkout flow", async (t) => {
          await t.step("selected by name", () => undefined);
        });
        smoke.suite("account settings flow", () => {
          throw new Error("unselected suite should not run");
        });
      `,
            'utf8',
        );

        const result = await runCli(['run', 'checkout'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /billing checkout flow/u);
        assert.match(result.stdout, /PASS selected by name/u);
        assert.doesNotMatch(result.stdout, /account settings flow/u);
        assert.doesNotMatch(result.stdout, /unselected suite should not run/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque run source path fragments do not import unselected smoke files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-path-import-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'good.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("good selected smoke", async (t) => {
          await t.step("selected file ran", () => undefined);
        });
      `,
            'utf8',
        );
        await writeFile(
            join(root, 'smoke', 'bad.smoke.mjs'),
            `
        throw new Error("unselected smoke file should not import");
      `,
            'utf8',
        );

        for (const pattern of ['smoke/good.smoke.mjs', 'good', 'good.smoke', 'smoke/good']) {
            const result = await runCli(['run', pattern], root);

            assert.equal(result.exitCode, 0, cliResultSummary(result, pattern));
            assert.equal(result.stderr, '', pattern);
            assert.match(result.stdout, /good selected smoke/u, pattern);
            assert.match(result.stdout, /PASS selected file ran/u, pattern);
            assert.doesNotMatch(result.stdout, /unselected smoke file should not import/u, pattern);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque run filters suites by tag', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-tags-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'tagged.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, async (t) => {
          await t.step("selected", () => undefined);
        });
        smoke.suite("slow package smoke", { tags: ["package", "slow"] }, () => {
          throw new Error("slow suite should be skipped");
        });
        smoke.suite("service smoke", { tags: ["service"] }, () => {
          throw new Error("service suite should be skipped");
        });
      `,
            'utf8',
        );

        const result = await runCli(['run', 'smoke/tagged.smoke.mjs', '--tag', 'package', '--skip-tag', 'slow'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /package smoke/u);
        assert.match(result.stdout, /PASS selected/u);
        assert.doesNotMatch(result.stdout, /slow suite should be skipped/u);
        assert.doesNotMatch(result.stdout, /service suite should be skipped/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
