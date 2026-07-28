import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque directory path patterns stay inside the selected directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-directory-path-import-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await mkdir(join(root, 'examples'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'good.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("good directory smoke", async (t) => {
          await t.step("selected directory ran", () => undefined);
        });
      `,
            'utf8',
        );
        await writeFile(
            join(root, 'examples', 'bad.smoke.mjs'),
            `
        throw new Error("unselected example smoke should not import");
      `,
            'utf8',
        );

        const listed = await runCli(['list', 'smoke/'], root);
        assert.equal(listed.exitCode, 0, cliResultSummary(listed));
        assert.equal(listed.stderr, '');
        assert.match(listed.stdout, /^good directory smoke\tsmoke\/good\.smoke\.mjs\t-$/mu);
        assert.doesNotMatch(listed.stdout, /unselected example smoke should not import/u);

        const ran = await runCli(['run', 'smoke/'], root);
        assert.equal(ran.exitCode, 0, cliResultSummary(ran));
        assert.equal(ran.stderr, '');
        assert.match(ran.stdout, /good directory smoke/u);
        assert.match(ran.stdout, /PASS selected directory ran/u);
        assert.doesNotMatch(ran.stdout, /unselected example smoke should not import/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque list reports missing fragments clearly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-list-missing-fragment-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'project.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("billing checkout flow", () => undefined);
      `,
            'utf8',
        );

        const result = await runCli(['list', 'does-not-exist'], root);

        assert.equal(result.exitCode, 2, cliResultSummary(result));
        assert.match(result.stderr, /No smoke suites matched: does-not-exist/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
