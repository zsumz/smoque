import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque list discovers suites and prints their source files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'api.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("api smoke", () => undefined);
        smoke.suite("api package smoke", { tags: ["package"] }, () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['list', 'api'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /^api smoke\tsmoke\/api\.smoke\.mjs\t-$/mu);
        assert.match(result.stdout, /^api package smoke\tsmoke\/api\.smoke\.mjs\tpackage$/mu);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque list matches suite name fragments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-name-fragment-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'project.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("billing checkout flow", { tags: ["web"] }, () => undefined);
        smoke.suite("account settings flow", () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['list', 'checkout'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /^billing checkout flow\tsmoke\/project\.smoke\.mjs\tweb$/mu);
        assert.doesNotMatch(result.stdout, /account settings flow/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque list discovers TypeScript smoke files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-ts-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'api.smoke.ts'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        const name: string = "api ts smoke";
        smoke.suite(name, () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['list', 'api.smoke.ts'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /^api ts smoke\tsmoke\/api\.smoke\.ts\t-$/mu);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque list source path fragments do not import unselected smoke files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-path-import-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'good.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("good selected smoke", () => undefined);
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

        for (const pattern of ['./smoke/good.smoke.mjs', 'good', 'good.smoke', 'smoke/good']) {
            const result = await runCli(['list', pattern], root);

            assert.equal(result.exitCode, 0, cliResultSummary(result, pattern));
            assert.equal(result.stderr, '', pattern);
            assert.match(result.stdout, /^good selected smoke\tsmoke\/good\.smoke\.mjs\t-$/mu, pattern);
            assert.doesNotMatch(result.stdout, /unselected smoke file should not import/u, pattern);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
