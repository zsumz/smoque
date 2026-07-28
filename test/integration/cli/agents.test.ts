import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, runCli } from './cli-harness.js';

test('smoque agents init writes smoke conventions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-agents-'));

    try {
        const result = await runCli(['agents', 'init'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /Created smoke\/AGENTS\.md/u);

        const agents = await readFile(join(root, 'smoke', 'AGENTS.md'), 'utf8');
        assert.match(agents, /^# Smoke Test Conventions/mu);
        assert.match(agents, /Use `smoque`/u);
        assert.match(agents, /Name files `\*\.smoke\.ts`\./u);
        assert.match(agents, /Prefer `t\.cmd\(command, args\)` when arguments are known\./u);
        assert.match(agents, /Prefer fake HTTP servers over calls to real services\./u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque agents init refuses to overwrite unless forced', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-agents-existing-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(join(root, 'smoke', 'AGENTS.md'), '# Existing\n', 'utf8');

        const refused = await runCli(['agents', 'init'], root);

        assert.equal(refused.exitCode, 2, cliResultSummary(refused));
        assert.match(refused.stderr, /already exists/u);
        assert.equal(await readFile(join(root, 'smoke', 'AGENTS.md'), 'utf8'), '# Existing\n');

        const forced = await runCli(['agents', 'init', '--force'], root);

        assert.equal(forced.exitCode, 0, cliResultSummary(forced));
        assert.match(forced.stdout, /Updated smoke\/AGENTS\.md/u);
        assert.match(
            await readFile(join(root, 'smoke', 'AGENTS.md'), 'utf8'),
            /^# Smoke Test Conventions/mu,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
