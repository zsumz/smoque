import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import postgresPlugin from '../../../../dist/plugins/postgres.js';
import { createFakePsql } from './fake-psql.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('postgres psql check parses typical versions and allows missing version text', async () => {
    const scenarios = [
        { output: 'psql (PostgreSQL) 16.2', version: '16.2' },
        { output: 'psql (PostgreSQL) 15.6 (Homebrew)', version: '15.6' },
        { output: 'psql from custom build', version: undefined },
    ];

    for (const scenario of scenarios) {
        resetSmokeRegistry();
        const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-check-'));
        const psql = await createFakePsql(root, { versionOutput: scenario.output });

        smoke.use(postgresPlugin());
        smoke.suite('postgres check', async (t) => {
            const info = await t.postgres.check({ psql });
            assert.equal(info.psql.command, psql);
            assert.equal(info.psql.version, scenario.version);
        });

        try {
            const result = await runRegisteredSuites({ repoRoot: root });
            assert.equal(result.status, 'passed');
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    }
});

test('postgres psql check failure preserves command output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-check-failure-'));
    const psql = await createFakePsql(root, {
        versionExitCode: 127,
        versionOutput: 'partial version output',
        versionStderr: 'psql missing',
    });

    smoke.use(postgresPlugin());
    smoke.suite('postgres check failure', async (t) => {
        await t.postgres.check({ psql });
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error?.details);
        assert.equal(error.name, 'SmokeError');
        assert.match(error.message, /Postgres psql client is not available/u);
        assert.equal(error.details.command, psql);
        assert.deepEqual(error.details.args, ['--version']);
        assert.equal(error.details.exitCode, 127);
        assert.equal(error.details.stdout, 'partial version output\n');
        assert.equal(error.details.stderr, 'psql missing\n');
        assert.match(String(error.details.installHint), /Install PostgreSQL client tools/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
