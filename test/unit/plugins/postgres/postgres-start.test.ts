import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import composePlugin from '../../../../dist/plugins/compose.js';
import postgresPlugin from '../../../../dist/plugins/postgres.js';
import {
    createFakePostgresDocker,
    readFakePostgresDockerLog,
} from './fake-postgres-docker.js';
import { createFakePsql, readFakePsqlLog } from './fake-psql.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('postgres plugin can start a disposable database through compose', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-start-'));
    const docker = await createFakePostgresDocker(root);
    const psql = await createFakePsql(root);

    smoke.use(composePlugin());
    smoke.use(postgresPlugin());
    smoke.suite('postgres start', async (t) => {
        const db = await t.postgres.start({
            docker,
            psql,
            projectName: 'Pg Stack',
            database: 'demo',
            timeout: '5s',
        });

        assert.equal(db.url, 'postgres://postgres:postgres@127.0.0.1:55432/demo');
        await db.sql('select 1');
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const dockerLog = await readFakePostgresDockerLog(root);
        const psqlLog = await readFakePsqlLog(root);

        assert.equal(result.status, 'passed');
        assert.ok(dockerLog.some((entry) => entry.args.includes('up')));
        assert.ok(dockerLog.some((entry) => entry.args.includes('port')));
        assert.ok(dockerLog.some((entry) => entry.args.includes('down')));
        assert.ok(psqlLog.some((entry) => entry.args.some((arg) => arg.includes('select 1 as ok'))));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('postgres.start retries readiness until the database accepts queries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-start-retry-'));
    const docker = await createFakePostgresDocker(root);
    const psql = await createFakePsql(root, { readyFailures: 2 });

    smoke.use(composePlugin());
    smoke.use(postgresPlugin());
    smoke.suite('postgres start retry', async (t) => {
        const db = await t.postgres.start({ docker, psql, timeout: '2s' });
        assert.equal(db.url, 'postgres://postgres:postgres@127.0.0.1:55432/app');
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const psqlLog = await readFakePsqlLog(root);

        assert.equal(result.status, 'passed');
        assert.equal(
            psqlLog.filter((entry) =>
                entry.args.some((arg) => arg.includes('select 1 as ok'))).length,
            3,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('postgres.start timeout preserves readiness query diagnostics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-start-timeout-'));
    const docker = await createFakePostgresDocker(root);
    const psql = await createFakePsql(root, { readyFailures: 99 });

    smoke.use(composePlugin());
    smoke.use(postgresPlugin());
    smoke.suite('postgres start timeout', async (t) => {
        await t.postgres.start({ docker, psql, timeout: '300ms' });
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error?.details);
        assert.equal(error.name, 'ProbeTimeoutError');
        assert.equal(error.details.name, 'Postgres readiness');
        assertRecord(error.details.lastError);
        assertRecord(error.details.lastError.details);
        assert.equal(error.details.lastError.details.sql, 'select 1 as ok');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
    assert.ok(typeof value === 'object' && value !== null);
}
