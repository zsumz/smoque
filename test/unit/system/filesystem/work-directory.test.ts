import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.workDir cleans stale content, returns a repo-local path, and cleans up after success', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'smoque-workdir-root-'));
    const stalePath = join(repoRoot, 'target', 'smoke', 'old.txt');
    let workPath: string | undefined;

    await mkdir(join(repoRoot, 'target', 'smoke'), { recursive: true });
    await writeFile(stalePath, 'stale', 'utf8');

    smoke.suite('work dir', async (t) => {
        const work = await t.workDir('target/smoke', { clean: true });
        workPath = work.toString();

        assert.equal(work.path('new.txt'), join(repoRoot, 'target', 'smoke', 'new.txt'));
        assert.equal(await t.fs.exists(work.path('old.txt')), false);

        await t.fs.writeJson(work.path('new.json'), { ok: true });
        assert.equal(await t.fs.readText(work.path('new.json')), '{\n  "ok": true\n}\n');
    });

    try {
        const result = await runRegisteredSuites({ repoRoot });

        assert.equal(result.status, 'passed');
        assert.ok(workPath);
        await assert.rejects(access(workPath), /ENOENT/u);
    } finally {
        await rm(repoRoot, { recursive: true, force: true });
    }
});
