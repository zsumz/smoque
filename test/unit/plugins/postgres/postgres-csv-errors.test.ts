import assert from 'node:assert/strict';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { parseCsv } from '../../../../dist/plugins/postgres/csv.js';
import {
    postgresQueryError,
    postgresSqlError,
} from '../../../../dist/plugins/postgres/errors.js';

test('postgres CSV parser handles quoted and ragged rows', () => {
    assert.deepEqual(parseCsv(''), []);

    const rows = parseCsv([
        'id,name,note',
        '1,"Ada, Lovelace","said ""hello"""',
        '2,"Grace',
        'Hopper",line break',
        '',
        '3,Bob,',
        '4,OnlyName',
        '',
    ].join('\r\n'));

    assert.deepEqual(rows, [
        { id: '1', name: 'Ada, Lovelace', note: 'said "hello"' },
        { id: '2', name: 'Grace\r\nHopper', note: 'line break' },
        { id: '3', name: 'Bob', note: '' },
        { id: '4', name: 'OnlyName', note: '' },
    ]);
});

test('postgres error wrappers preserve details, SQL, and params', () => {
    const sql = 'select * from users where id = :\'id\'';
    const params = { id: 7 };
    const cause = new SmokeError('psql exited 2', {
        command: 'psql',
        stdout: 'partial output',
        stderr: 'syntax error',
    });

    const queryWrapped = postgresQueryError(cause, sql, params);
    assert.equal(queryWrapped.message, 'Postgres query failed: psql exited 2');
    assert.equal(queryWrapped.details?.command, 'psql');
    assert.equal(queryWrapped.details.stdout, 'partial output');
    assert.equal(queryWrapped.details.stderr, 'syntax error');
    assert.equal(queryWrapped.details.sql, sql);
    assert.deepEqual(queryWrapped.details.params, params);

    const queryString = postgresQueryError('network closed', sql, params);
    assert.equal(queryString.message, 'Postgres query failed: network closed');
    assert.equal(queryString.details?.sql, sql);
    assert.deepEqual(queryString.details.params, params);

    const sqlWrapped = postgresSqlError(cause, sql, params);
    assert.equal(sqlWrapped.message, 'Postgres SQL command failed: psql exited 2');
    assert.equal(sqlWrapped.details?.stderr, 'syntax error');
    assert.equal(sqlWrapped.details.sql, sql);
    assert.deepEqual(sqlWrapped.details.params, params);

    const sqlString = postgresSqlError('permission denied', sql, params);
    assert.equal(sqlString.message, 'Postgres SQL command failed: permission denied');
    assert.equal(sqlString.details?.sql, sql);
    assert.deepEqual(sqlString.details.params, params);
});
