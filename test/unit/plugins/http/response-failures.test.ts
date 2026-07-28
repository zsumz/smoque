import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'vitest';

import {
    createJsonReporter,
    resetSmokeRegistry,
    runRegisteredSuites,
    smoke,
} from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http response header assertions fail clearly', async () => {
    const server = createServer((_request, response) => {
        response.setHeader('content-type', 'text/plain');
        response.end('ok');
    });

    await listen(server);
    const baseUrl = `http://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('response headers', async (t) => {
        const response = await t.http.get(`${baseUrl}/health`);
        response.expectHeader('x-missing').toExist();
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });

        assert.equal(result.status, 'failed');
        assert.match(
            result.suites[0]?.error?.message ?? '',
            /Expected response header x-missing to exist/u,
        );
    } finally {
        await close(server);
    }
});

test('http response failures attach redacted transcripts', async () => {
    const secret = 'response-secret-123';
    const reporter = createJsonReporter({ write: () => undefined });
    const server = createServer((_request, response) => {
        response.statusCode = 500;
        response.setHeader('content-type', 'application/json');
        response.setHeader('x-debug-token', secret);
        response.end(JSON.stringify({ error: secret }));
    });

    await listen(server);
    const baseUrl = `http://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('http transcript', async (t) => {
        t.redact(secret);
        const response = await t.http.get(`${baseUrl}/health`, {
            headers: { authorization: `Bearer ${secret}` },
        });
        response.expectStatus(200);
    });

    try {
        const result = await runRegisteredSuites({
            repoRoot: process.cwd(),
            eventSink: reporter,
        });
        const artifact = reporter.report().suites[0]?.artifacts[0];

        assert.equal(result.status, 'failed');
        assert.ok(artifact);
        assert.equal(artifact.name, 'http-GET-127.0.0.1-health.transcript.txt');
        assert.equal(artifact.kind, 'text');

        const transcript = await readFile(artifact.path, 'utf8');
        assert.match(transcript, /GET http:\/\/127\.0\.0\.1:\d+\/health/u);
        assert.match(transcript, /Response status: 500/u);
        assert.match(transcript, /authorization: \[redacted\]/u);
        assert.match(transcript, /x-debug-token: \[redacted\]/u);
        assert.doesNotMatch(transcript, new RegExp(secret, 'u'));
    } finally {
        await close(server);
    }
});
