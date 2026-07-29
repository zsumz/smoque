import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('redirect loops fail at the fixed redirect limit', async () => {
    let requests = 0;
    const server = createServer((request, response) => {
        requests += 1;
        response.statusCode = 302;
        response.setHeader('location', request.url === '/a' ? '/b' : '/a');
        response.end();
    });
    await listen(server);

    smoke.use(httpPlugin());
    smoke.suite('redirect loop', async (t) => {
        await t.http.get(`http://127.0.0.1:${String(serverPort(server))}/a`);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(error.message, /HTTP redirect limit exceeded after 20 redirects/u);
        assert.equal(requests, 21);
    } finally {
        await close(server);
    }
});
