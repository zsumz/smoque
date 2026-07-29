import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('redirect destinations are authorized before network access', async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
        requests += 1;
        response.statusCode = 302;
        response.setHeader('location', 'http://blocked.invalid/private');
        response.end();
    });
    await listen(server);

    smoke.use(httpPlugin());
    smoke.suite('blocked redirect', async (t) => {
        t.net.policy({ external: 'block' });
        await t.http.get(`http://127.0.0.1:${String(serverPort(server))}/start`);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(
            error.message,
            /Blocked external network request: GET blocked\.invalid\/private/u,
        );
        assert.equal(requests, 1);
    } finally {
        await close(server);
    }
});

test('allowed redirect destinations are followed', async () => {
    const target = createServer((_request, response) => {
        response.end('redirected');
    });
    await listen(target);
    const source = createServer((_request, response) => {
        response.statusCode = 302;
        response.setHeader(
            'location',
            `http://127.0.0.1:${String(serverPort(target))}/target`,
        );
        response.end();
    });
    await listen(source);

    smoke.use(httpPlugin());
    smoke.suite('allowed redirect', async (t) => {
        t.net.policy({ external: 'block' });
        const response = await t.http.get(
            `http://127.0.0.1:${String(serverPort(source))}/start`,
        );
        response.expectStatus(200);
        assert.equal(response.body, 'redirected');
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        assert.equal(result.status, 'passed');
    } finally {
        await close(source);
        await close(target);
    }
});

test('cross-origin redirects strip sensitive headers and retain ordinary headers', async () => {
    let receivedHeaders: Record<string, string | string[] | undefined> | undefined;
    const target = createServer((request, response) => {
        receivedHeaders = request.headers;
        response.end('redirected');
    });
    await listen(target);
    const source = createServer((_request, response) => {
        response.statusCode = 302;
        response.setHeader(
            'location',
            `http://127.0.0.1:${String(serverPort(target))}/target`,
        );
        response.end();
    });
    await listen(source);

    smoke.use(httpPlugin());
    smoke.suite('sensitive redirect headers', async (t) => {
        await t.http.get(
            `http://127.0.0.1:${String(serverPort(source))}/start`,
            {
                headers: {
                    authorization: 'Bearer secret',
                    cookie: 'session=secret',
                    cookie2: 'legacy=secret',
                    host: 'spoofed.invalid',
                    'proxy-authorization': 'Basic secret',
                    'www-authenticate': 'Basic realm=secret',
                    'x-request-id': 'request-1',
                },
            },
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });

        assert.equal(result.status, 'passed');
        assert.ok(receivedHeaders);
        for (const name of [
            'authorization',
            'cookie',
            'cookie2',
            'proxy-authorization',
            'www-authenticate',
        ]) {
            assert.equal(receivedHeaders[name], undefined);
        }
        assert.equal(receivedHeaders['x-request-id'], 'request-1');
        assert.equal(
            receivedHeaders.host,
            `127.0.0.1:${String(serverPort(target))}`,
        );
    } finally {
        await close(source);
        await close(target);
    }
});
