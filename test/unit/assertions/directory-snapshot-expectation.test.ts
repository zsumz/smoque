import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';

import { expect, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

interface SnapshotEntry {
    path: string;
    checksum?: { algorithm: string };
}

interface DirectorySnapshot {
    schemaVersion: string;
    entries: SnapshotEntry[];
}

test('directory snapshots report added, removed, and changed entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-expect-dir-snapshot-'));
    const outputDir = join(root, 'generated');
    const snapshotPath = join(root, '__snapshots__', 'generated.json');

    try {
        await mkdir(join(outputDir, 'assets'), { recursive: true });
        await writeFile(join(outputDir, 'index.html'), '<h1>Hello</h1>\n', 'utf8');
        await writeFile(join(outputDir, 'assets', 'app.js'), 'console.log("hello");\n', 'utf8');

        smoke.suite('write directory snapshot', async () => {
            await expect.directory(outputDir).toMatchSnapshot(snapshotPath, { checksum: 'sha256' });
        });

        let result = await runRegisteredSuites({ repoRoot: root, updateSnapshots: true });
        const snapshot: unknown = JSON.parse(await readFile(snapshotPath, 'utf8'));
        assertDirectorySnapshot(snapshot);

        assert.equal(result.status, 'passed');
        assert.equal(snapshot.schemaVersion, 'smoque.directory-snapshot.v1');
        assert.deepEqual(snapshot.entries.map((entry) => entry.path), [
            'assets',
            'assets/app.js',
            'index.html',
        ]);
        assert.equal(
            snapshot.entries.find((entry) => entry.path === 'index.html')?.checksum?.algorithm,
            'sha256',
        );

        await rm(join(outputDir, 'assets', 'app.js'));
        await writeFile(join(outputDir, 'index.html'), '<h1>Changed</h1>\n', 'utf8');
        await writeFile(join(outputDir, 'extra.txt'), 'extra\n', 'utf8');

        resetSmokeRegistry();
        smoke.suite('match directory snapshot', async () => {
            await expect.directory(outputDir).toMatchSnapshot(snapshotPath, { checksum: 'sha256' });
        });

        result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;
        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(error.message, /Directory snapshot did not match/u);
        assert.deepEqual(detailPaths(error.details?.added), ['extra.txt']);
        assert.deepEqual(detailPaths(error.details?.removed), ['assets/app.js']);
        assert.deepEqual(detailPaths(error.details?.changed), ['index.html']);
    } finally {
        resetSmokeRegistry();
        await rm(root, { recursive: true, force: true });
    }
});

function assertDirectorySnapshot(value: unknown): asserts value is DirectorySnapshot {
    assert.ok(typeof value === 'object' && value !== null);
    assert.ok('schemaVersion' in value && typeof value.schemaVersion === 'string');
    assert.ok('entries' in value);
    const entries: unknown = value.entries;
    assert.ok(isUnknownArray(entries));
    for (const entry of entries) {
        assert.ok(typeof entry === 'object' && entry !== null);
        assert.ok('path' in entry && typeof entry.path === 'string');
    }
}

function isUnknownArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

function detailPaths(value: unknown): string[] {
    assert.ok(Array.isArray(value));
    return value.map((entry: unknown) => {
        assert.ok(typeof entry === 'object' && entry !== null);
        assert.ok('path' in entry && typeof entry.path === 'string');
        return entry.path;
    });
}
