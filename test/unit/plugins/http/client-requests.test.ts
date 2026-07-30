import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, readBody, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http plugin performs requests and JSON assertions', async () => {
    const received: unknown[] = [];
    const unicodeBody = 'before 🌊 after';
    const server = createServer((request, response) => {
        if (request.url === '/health') {
            response.setHeader('content-type', 'application/json');
            response.setHeader('x-smoke-service', 'users');
            response.end(JSON.stringify({ status: 'ok' }));
            return;
        }

        if (request.url === '/users' && request.method === 'POST') {
            readBody(request).then((body) => {
                const parsedBody: unknown = JSON.parse(body);
                received.push(parsedBody);
                response.statusCode = 201;
                response.setHeader('content-type', 'application/json');
                response.end(JSON.stringify({ id: 'user_1' }));
            }).catch((error: unknown) => {
                response.statusCode = 500;
                response.end(String(error));
            });
            return;
        }

        if (request.url === '/unicode') {
            const encoded = Buffer.from(unicodeBody);
            response.write(encoded.subarray(0, 9));
            response.end(encoded.subarray(9));
            return;
        }

        response.statusCode = 404;
        response.end('missing');
    });

    await listen(server);
    const baseUrl = `http://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('http requests', async (t) => {
        const health = await t.http.get(`${baseUrl}/health`);
        health
            .expectStatus(200)
            .expectHeader('content-type')
            .matching(/application\/json/u)
            .expectHeader('x-smoke-service')
            .toBe('users')
            .expectJsonPath('$.status')
            .toBe('ok');

        const created = await t.http.post(`${baseUrl}/users`, {
            json: { email: 'smoke@example.com' },
        });
        created.expectStatus(201).expectJsonPath('$.id').toExist();

        const unicode = await t.http.get(`${baseUrl}/unicode`);
        assert.equal(unicode.body, unicodeBody);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });

        assert.equal(result.status, 'passed');
        assert.deepEqual(received, [{ email: 'smoke@example.com' }]);
    } finally {
        await close(server);
    }
});
