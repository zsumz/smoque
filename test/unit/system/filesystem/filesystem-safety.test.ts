import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, parse } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.fs.rm refuses to remove the repo root', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'smoque-repo-root-'));

    smoke.suite('safe rm', async (t) => {
        await assert.rejects(async () => t.fs.rm(t.repoRoot(), { recursive: true, force: true }), /Refusing to remove unsafe path/u);
        await assert.rejects(async () => t.fs.rm(dirname(repoRoot), { recursive: true, force: true }), /Refusing to remove unsafe path/u);
        await assert.rejects(async () => t.fs.rm(parse(repoRoot).root, { recursive: true, force: true }), /Refusing to remove unsafe path/u);
        await assert.rejects(async () => t.fs.rm(homedir(), { recursive: true, force: true }), /Refusing to remove unsafe path/u);

        await t.fs.mkdir('keep');
        await assert.rejects(async () => t.fs.rm('keep', { recursive: true, force: true, refuse: ['keep'] }), /Refusing to remove unsafe path/u);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot });

        assert.equal(result.status, 'passed');
        await access(repoRoot);
    } finally {
        await rm(repoRoot, { recursive: true, force: true });
    }
});

test('t.fs resolves string paths relative to repoRoot', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'smoque-fs-context-root-'));
    const relativeDir = `.smoque-context-${String(process.pid)}`;

    try {
        await writeFile(join(repoRoot, 'package.json'), 'repo-root package\n', 'utf8');

        smoke.suite('context filesystem', async (t) => {
            assert.equal(await t.fs.readText('package.json'), 'repo-root package\n');

            await t.fs.mkdir(relativeDir);
            await t.fs.writeText(`${relativeDir}/note.txt`, 'hello');
            await t.fs.copy(`${relativeDir}/note.txt`, `${relativeDir}/copy.txt`);

            assert.equal(await t.fs.exists(relativeDir), true);
            assert.equal(await t.fs.readText(`${relativeDir}/copy.txt`), 'hello');
            assert.deepEqual(await t.fs.ready(`${relativeDir}/copy.txt`).check(), {
                ready: true,
                message: join(repoRoot, relativeDir, 'copy.txt'),
            });

            await t.fs.rm(`${relativeDir}/copy.txt`);
            assert.equal(await t.fs.exists(`${relativeDir}/copy.txt`), false);
        });

        const result = await runRegisteredSuites({ repoRoot });

        assert.equal(result.status, 'passed');
        assert.equal(await readFile(join(repoRoot, relativeDir, 'note.txt'), 'utf8'), 'hello');
    } finally {
        await rm(repoRoot, { recursive: true, force: true });
        await rm(join(process.cwd(), relativeDir), { recursive: true, force: true });
    }
});
