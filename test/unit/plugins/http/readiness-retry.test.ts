import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.ready succeeds after retrying a not-ready response', async () => {
    let attempts = 0;
    const server = createServer((_request, response) => {
        attempts += 1;
        if (attempts === 1) {
            response.statusCode = 503;
            response.end('booting');
            return;
        }

        response.end('ok');
    });

    await listen(server);
    const baseUrl = `http://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('http ready retry', async (t) => {
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
            { timeout: '200ms', interval: '5ms' },
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });

        assert.equal(result.status, 'passed');
        assert.equal(attempts, 2);
    } finally {
        await close(server);
    }
});
