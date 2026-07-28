import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque run ignores local artifact directories during discovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-run-ignored-dirs-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'good.smoke.mjs'),
            `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("visible smoke", async (t) => {
          await t.step("runs", () => undefined);
        });
      `,
            'utf8',
        );

        for (const directory of ['.tmp', 'coverage', '.idea', '__MACOSX']) {
            await mkdir(join(root, directory), { recursive: true });
            await writeFile(
                join(root, directory, 'ignored.smoke.mjs'),
                `
          throw new Error(${JSON.stringify(`${directory} smoke should not import`)});
        `,
                'utf8',
            );
        }

        const result = await runCli(['run'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /visible smoke/u);
        assert.match(result.stdout, /PASS runs/u);
        assert.doesNotMatch(result.stdout, /should not import/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque snippets ignores local artifact directories during markdown discovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-snippets-ignored-dirs-'));

    try {
        await mkdir(join(root, 'docs'), { recursive: true });
        await writeFile(
            join(root, 'docs', 'guide.md'),
            [
                '# Guide',
                '',
                '```js smoque',
                'import { smoke } from \'smoque\';',
                'smoke.suite(\'visible docs snippet\', async (t) => {',
                '  await t.step(\'runs\', () => undefined);',
                '});',
                '```',
                '',
            ].join('\n'),
            'utf8',
        );

        for (const directory of ['.tmp', 'coverage', '.idea', '__MACOSX']) {
            await mkdir(join(root, directory), { recursive: true });
            await writeFile(
                join(root, directory, 'ignored.md'),
                [
                    '# Ignored',
                    '',
                    '```js smoque',
                    'throw new Error(\'ignored markdown should not run\');',
                    '```',
                    '',
                ].join('\n'),
                'utf8',
            );
        }

        const result = await runCli(['snippets', '.'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /PASS docs\/guide\.md > Guide > line 4/u);
        assert.match(result.stdout, /Result: passed 1 snippet/u);
        assert.doesNotMatch(result.stdout, /ignored markdown should not run/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
