import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, runCli } from './cli-harness.js';

test('smoque --version prints the package version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-version-'));

    try {
        const result = await runCli(['--version'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /^0\.1\.0\n$/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque help commands print lowercase help', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-help-'));

    try {
        for (const args of [['help'], ['--help'], ['-h']]) {
            const result = await runCli(args, root);

            assert.equal(result.exitCode, 0, cliResultSummary(result));
            assert.equal(result.stderr, '');
            assert.match(result.stdout, /^smoque\n\nUsage:/u);
            assert.match(result.stdout, /smoque run \[suite-or-pattern\]/u);
            assert.match(result.stdout, /smoque snippets \[markdown-file-or-dir\]/u);
            assert.doesNotMatch(result.stdout, /Smoque/u);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque reports unknown commands and options', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-unknown-'));

    try {
        const unknownCommand = await runCli(['wat'], root);

        assert.equal(unknownCommand.exitCode, 2, cliResultSummary(unknownCommand));
        assert.match(unknownCommand.stderr, /Unknown command: wat/u);
        assert.match(unknownCommand.stdout, /^smoque\n\nUsage:/u);

        for (const [args, message] of [
            [['run', '--wat'], /Unknown smoque run option: --wat/u],
            [['list', '--wat'], /Unknown smoque list option: --wat/u],
            [['snippets', '--wat'], /Unknown smoque snippets option: --wat/u],
        ] as const) {
            const result = await runCli(args, root);

            assert.notEqual(result.exitCode, 0, cliResultSummary(result));
            assert.equal(result.stdout, '');
            assert.match(result.stderr, message);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque reports missing option values', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-missing-options-'));

    try {
        for (const [args, message] of [
            [['run', '--json'], /--json requires a value\./u],
            [['run', '--junit'], /--junit requires a value\./u],
            [['run', '--tag'], /--tag requires a tag\./u],
            [['run', '--skip-tag'], /--skip-tag requires a tag\./u],
            [['snippets', '--timeout'], /--timeout requires a value\./u],
        ] as const) {
            const result = await runCli(args, root);

            assert.notEqual(result.exitCode, 0, cliResultSummary(result));
            assert.equal(result.stdout, '');
            assert.match(result.stderr, message);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque reports unexpected positional arguments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-unexpected-args-'));

    try {
        for (const [args, message] of [
            [['run', 'first', 'second'], /Unexpected smoque run argument: second/u],
            [['list', 'first', 'second'], /Unexpected smoque list argument: second/u],
            [['snippets', 'first', 'second'], /Unexpected smoque snippets argument: second/u],
        ] as const) {
            const result = await runCli(args, root);

            assert.notEqual(result.exitCode, 0, cliResultSummary(result));
            assert.equal(result.stdout, '');
            assert.match(result.stderr, message);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque rejects empty comma tag lists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-empty-tags-'));

    try {
        for (const [args, message] of [
            [['run', '--tag', ','], /--tag requires at least one tag\./u],
            [['run', '--skip-tag', ', ,'], /--skip-tag requires at least one tag\./u],
            [['list', '--tag', ','], /--tag requires at least one tag\./u],
        ] as const) {
            const result = await runCli(args, root);

            assert.notEqual(result.exitCode, 0, cliResultSummary(result));
            assert.equal(result.stdout, '');
            assert.match(result.stderr, message);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
