import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, findFiles, runCli } from './cli-harness.js';

test('smoque run exits non-zero when a smoke suite fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-fail-'));

    try {
        await writeFile(
            join(root, 'failure.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("cli failure smoke", async (t) => {
          await t.step("fails", () => {
            throw new Error("nope");
          });
        });
      `,
            'utf8',
        );

        const result = await runCli(['run'], root);

        assert.equal(result.exitCode, 1, cliResultSummary(result));
        assert.match(result.stdout, /FAIL fails/u);
        assert.match(result.stdout, /Failure: cli failure smoke > fails/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque run --ci emits GitHub Actions annotations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-ci-'));

    try {
        await writeFile(
            join(root, 'failure.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("ci failure smoke", async (t) => {
          await t.step("fails loudly", () => {
            throw new Error("ci nope");
          });
        });
      `,
            'utf8',
        );

        const result = await runCli(['run', '--ci'], root);

        assert.equal(result.exitCode, 1, cliResultSummary(result));
        assert.match(result.stdout, /FAIL fails loudly/u);
        assert.match(
            result.stdout,
            /::error file=.*failure\.smoke\.mjs,title=ci failure smoke > fails loudly::Error: ci nope/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque run --keep-workdir-on-fail preserves failed fixture workdirs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-keep-workdir-'));
    const marker = `kept for inspection ${String(Date.now())}`;
    const preservedRoots = [];

    try {
        await writeFile(
            join(root, 'fixture.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("fixture failure smoke", async (t) => {
          const work = await t.tempDir("package-fixture");

          await t.step("write fixture evidence", async () => {
            await t.fs.writeText(work.path("fixture", "debug.log"), ${JSON.stringify(marker)});
          });

          await t.step("fail after fixture setup", () => {
            throw new Error("fixture install failed");
          });
        });
      `,
            'utf8',
        );

        const result = await runCli(['run', '--keep-workdir-on-fail'], root);
        const preservedFiles = await findFiles(tmpdir(), 'debug.log');
        const matchingFiles = [];
        for (const file of preservedFiles) {
            if (await readFile(file, 'utf8') === marker) {
                matchingFiles.push(file);
                preservedRoots.push(dirname(dirname(file)));
            }
        }

        assert.equal(result.exitCode, 1, cliResultSummary(result));
        assert.match(result.stdout, /FAIL fail after fixture setup/u);
        assert.ok(matchingFiles.length > 0, 'expected debug.log to be preserved');
    } finally {
        await rm(root, { recursive: true, force: true });
        await Promise.all(preservedRoots.map(async (path) => rm(path, { recursive: true, force: true })));
    }
});
