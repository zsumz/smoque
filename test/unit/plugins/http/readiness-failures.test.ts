import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import {
    close,
    listen,
    reserveFreePort,
    serverPort,
} from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.ready reports not-ready status messages', async () => {
    const server = createServer((_request, response) => {
        response.statusCode = 503;
        response.end('booting');
    });

    await listen(server);
    const baseUrl = `http://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('http not ready', async (t) => {
        await t.poll(
            'http ready',
            async () => {
                const result = await t.http.ready(
                    `${baseUrl}/health`,
                    { timeout: '100ms' },
                ).check();
                if (!result.ready) {
                    throw new Error(result.message);
                }
            },
            { timeout: '30ms', interval: '5ms' },
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.equal(error.name, 'ProbeTimeoutError');
        const lastError = error.details?.lastError;
        assert.ok(typeof lastError === 'object' && lastError !== null);
        assert.ok('message' in lastError);
        assert.equal(lastError.message, 'status 503');
    } finally {
        await close(server);
    }
});

test('http.ready reports network failures as not ready', async () => {
    const port = await reserveFreePort();

    smoke.use(httpPlugin());
    smoke.suite('http ready network failure', async (t) => {
        const result = await t.http.ready(
            `http://127.0.0.1:${String(port)}/health`,
            { timeout: '50ms' },
        ).check();

        assert.equal(result.ready, false);
        assert.match(result.message ?? '', /fetch failed|ECONNREFUSED|connect/u);
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});
