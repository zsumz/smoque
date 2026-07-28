import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, runCli } from './cli-harness.js';

test('smoque doctor reports local project readiness', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-doctor-'));

    try {
        await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'doctor-fixture' }), 'utf8');
        await runCli(['init'], root);

        const result = await runCli(['doctor'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /smoque doctor/u);
        assert.match(result.stdout, /OK\s+node: v/u);
        assert.match(
            result.stdout,
            /OK\s+typescript smoke files: native (strip|transform) support on v\d+\.\d+\.\d+; \.smoke\.ts must use erasable TypeScript\./u,
        );
        assert.match(result.stdout, /OK\s+npm: \d/u);
        assert.match(result.stdout, /OK\s+package\.json: found doctor-fixture/u);
        assert.match(result.stdout, /OK\s+smoke files: 1 found\./u);
        assert.match(result.stdout, /OK\s+smoke\/AGENTS\.md: found\./u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque doctor warns when project scaffolding is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-doctor-warn-'));

    try {
        const result = await runCli(['doctor'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.match(result.stdout, /WARN package\.json: not found/u);
        assert.match(result.stdout, /WARN smoke files: none found/u);
        assert.match(result.stdout, /WARN smoke\/AGENTS\.md: not found/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque doctor fails on invalid package metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-doctor-fail-'));

    try {
        await writeFile(join(root, 'package.json'), '{ invalid json', 'utf8');

        const result = await runCli(['doctor'], root);

        assert.equal(result.exitCode, 1, cliResultSummary(result));
        assert.match(result.stdout, /FAIL package\.json: invalid JSON\./u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
