import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, coreUrl, runCli } from './cli-harness.js';

test('smoque run --update-snapshots writes text and directory snapshots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-update-snapshots-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'snapshot.smoke.mjs'),
            `
        import { expect, smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("snapshot smoke", async (t) => {
          const generated = t.repoRoot().path("generated");
          await t.fs.mkdir(generated);
          await t.fs.writeText(t.repoRoot().path("generated", "output.txt"), "hello snapshot\\n");

          await expect.text("hello snapshot\\n").toMatchSnapshot(t.repoRoot().path("__snapshots__", "output.txt"));
          await expect.directory(generated).toMatchSnapshot(t.repoRoot().path("__snapshots__", "generated.json"), {
            checksum: true,
          });
        });
      `,
            'utf8',
        );

        const result = await runCli(['run', '--update-snapshots'], root);
        const directorySnapshot = JSON.parse(await readFile(
            join(root, '__snapshots__', 'generated.json'),
            'utf8',
        )) as { entries: Array<{ checksum: { algorithm: string }; path: string }> };

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.equal(await readFile(join(root, '__snapshots__', 'output.txt'), 'utf8'), 'hello snapshot\n');
        assert.deepEqual(
            directorySnapshot.entries.map((entry: { path: string }) => entry.path),
            ['output.txt'],
        );
        const [entry] = directorySnapshot.entries;
        assert.equal(entry?.checksum.algorithm, 'sha256');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
