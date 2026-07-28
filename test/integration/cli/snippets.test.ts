import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, runCli } from './cli-harness.js';

test('smoque snippets runs marked markdown smoke blocks in isolated fixtures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-snippets-'));

    try {
        await mkdir(join(root, 'docs', 'fixtures', 'hello'), { recursive: true });
        await writeFile(join(root, 'docs', 'fixtures', 'hello', 'message.txt'), 'hello docs\n', 'utf8');
        await writeFile(
            join(root, 'docs', 'guide.md'),
            [
                '# Guide',
                '',
                '```ts',
                'throw new Error(\'ordinary docs block should not run\');',
                '```',
                '',
                '## Happy Path',
                '',
                '```ts smoque fixture=fixtures/hello',
                'import { smoke, expect } from "smoque";',
                '',
                'smoke.suite("docs snippet passes", async (t) => {',
                '  await t.step("read fixture", async () => {',
                '    const message = await t.fs.readText(t.repoRoot().path("message.txt"));',
                '    expect(message).toBe("hello docs\\n");',
                '  });',
                '});',
                '```',
                '',
                '## Expected Failure',
                '',
                '```ts smoque expect-fail',
                'import { smoke } from "smoque";',
                '',
                'smoke.suite("docs expected failure", async (t) => {',
                '  await t.step("fail intentionally", () => {',
                '    throw new Error("expected docs failure");',
                '  });',
                '});',
                '```',
                '',
            ].join('\n'),
            'utf8',
        );

        const result = await runCli(['snippets', 'docs/guide.md'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /smoque snippets/u);
        assert.match(result.stdout, /PASS docs\/guide\.md > Guide > Happy Path > line \d+/u);
        assert.match(result.stdout, /PASS docs\/guide\.md > Guide > Expected Failure > line \d+ \(expected failure\)/u);
        assert.match(result.stdout, /Result: passed 2 snippets/u);
        assert.doesNotMatch(result.stdout, /ordinary docs block should not run/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque snippets fails when an expected failure snippet passes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-snippets-unexpected-pass-'));

    try {
        await writeFile(
            join(root, 'README.md'),
            [
                '# Snippets',
                '',
                '```ts smoque expect-fail',
                'import { smoke } from "smoque";',
                '',
                'smoke.suite("unexpected pass", async (t) => {',
                '  await t.step("passes", () => undefined);',
                '});',
                '```',
                '',
            ].join('\n'),
            'utf8',
        );

        const result = await runCli(['snippets', 'README.md'], root);

        assert.equal(result.exitCode, 1, cliResultSummary(result));
        assert.match(result.stdout, /FAIL README\.md > Snippets > line \d+ \(expected failure passed\)/u);
        assert.match(result.stdout, /Source: README\.md > Snippets > line \d+/u);
        assert.match(result.stdout, /Result: failed 1 snippet/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
