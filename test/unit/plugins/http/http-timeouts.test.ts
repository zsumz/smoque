import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import {
    createHttpTimeoutSignal,
    parseHttpDuration,
} from '../../../../dist/plugins/http/client-timeout.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('HTTP timeouts retain the existing AbortError contract', async () => {
    const server = createServer(() => undefined);
    await listen(server);

    smoke.use(httpPlugin());
    smoke.suite('HTTP timeout', async (t) => {
        await t.http.get(
            `http://127.0.0.1:${String(serverPort(server))}/slow`,
            { timeout: '10ms' },
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.equal(error.name, 'AbortError');
        assert.equal(error.message, 'This operation was aborted');
    } finally {
        await close(server);
    }
});

test('an empty timeout remains disabled for plain HTTP requests', async () => {
    const server = createServer((_request, response) => {
        response.end('ok');
    });
    await listen(server);

    smoke.use(httpPlugin());
    smoke.suite('empty HTTP timeout', async (t) => {
        const response = await t.http.get(
            `http://127.0.0.1:${String(serverPort(server))}/`,
            { timeout: '' },
        );
        response.expectStatus(200);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        assert.equal(result.status, 'passed');
    } finally {
        await close(server);
    }
});

test('HTTP timeout parsing retains supported units and validation', () => {
    assert.equal(parseHttpDuration('12ms'), 12);
    assert.equal(parseHttpDuration('12s'), 12_000);
    assert.equal(parseHttpDuration('12m'), 720_000);
    assert.throws(
        () => parseHttpDuration('12'),
        /Invalid HTTP timeout: 12/u,
    );
});

test('HTTP timeout signals retain disabled and overflowing timer behavior', async () => {
    assert.equal(createHttpTimeoutSignal(''), undefined);

    const overflow = createHttpTimeoutSignal('71583m');
    assert.ok(overflow);
    await once(overflow, 'abort');

    const reason: unknown = overflow.reason;
    assert.ok(reason instanceof DOMException);
    assert.equal(reason.name, 'TimeoutError');
});
