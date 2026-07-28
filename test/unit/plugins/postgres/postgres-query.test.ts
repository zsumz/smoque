import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import postgresPlugin from '../../../../dist/plugins/postgres.js';
import { createFakePsql, readFakePsqlLog } from './fake-psql.js';

const selectUserSql = 'select id, name from users where id = :\'id\'';
const brokenUserSql = 'select broken from users where id = :\'id\'';

beforeEach(() => {
    resetSmokeRegistry();
});

test('postgres plugin connects with psql and asserts query rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-'));
    const psql = await createFakePsql(root);

    smoke.use(postgresPlugin());
    smoke.suite('postgres query', async (t) => {
        const info = await t.postgres.check({ psql });
        assert.equal(info.psql.command, psql);
        assert.equal(info.psql.version, '16.2');

        const db = await t.postgres.connect({
            url: 'postgres://user:secret@127.0.0.1:5432/app',
            psql,
        });
        await db.sql('create table users(id int, name text)');
        const result = await db.query(selectUserSql, {
            params: { id: 1 },
        });
        result.expectRow({ id: 1, name: 'Ada' }).expectRows([{ id: 1, name: 'Ada' }]);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const log = await readFakePsqlLog(root);

        assert.equal(result.status, 'passed');
        assert.ok(log.some((entry) => entry.args.includes('--version')));
        assert.ok(log.some((entry) => entry.args.includes('--set') && entry.args.includes('id=1')));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('postgres row assertions report query text, params, and row preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-failure-'));
    const psql = await createFakePsql(root);

    smoke.use(postgresPlugin());
    smoke.suite('postgres assertion failure', async (t) => {
        const db = await t.postgres.connect({
            url: 'postgres://user:secret@127.0.0.1:5432/app',
            psql,
        });
        const result = await db.query(selectUserSql, {
            params: { id: 2 },
        });
        result.expectRow({ id: 99 });
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error?.details);
        assert.match(error.message, /Expected Postgres query/u);
        assert.equal(error.details.sql, selectUserSql);
        assert.deepEqual(error.details.params, { id: 2 });
        assert.deepEqual(error.details.preview, [{ id: '1', name: 'Ada' }]);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('postgres query failures preserve command diagnostics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-postgres-query-fails-'));
    const psql = await createFakePsql(root, { queryFails: true });

    smoke.use(postgresPlugin());
    smoke.suite('postgres query command failure', async (t) => {
        const db = await t.postgres.connect({
            url: 'postgres://user:secret@127.0.0.1:5432/app',
            psql,
        });
        await db.query(brokenUserSql, {
            params: { id: 7 },
        });
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error?.details);
        assert.match(error.message, /Postgres query failed/u);
        assert.equal(error.details.sql, brokenUserSql);
        assert.deepEqual(error.details.params, { id: 7 });
        assert.equal(error.details.command, psql);
        assert.ok(Array.isArray(error.details.args));
        assert.ok(error.details.args.includes('--command'));
        assert.equal(error.details.exitCode, 13);
        assert.equal(error.details.stdout, 'partial query output\n');
        assert.equal(error.details.stderr, 'syntax error at or near broken\n');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
