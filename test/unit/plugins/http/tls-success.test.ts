import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';
import { generateLocalCertificate } from './local-certificate.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http plugin supports local CA certificates for HTTPS', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-http-tls-ca-'));
    const certificate = generateLocalCertificate(root);
    const server = createHttpsServer({
        key: await readFile(certificate.keyPath),
        cert: await readFile(certificate.certPath),
    }, (_request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ status: 'ok' }));
    });

    await listen(server);
    const baseUrl = `https://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('https local CA', async (t) => {
        t.net.policy({ external: 'block' });

        const ready = await t.http.ready(`${baseUrl}/health`, {
            tls: { ca: certificate.certPath },
            timeout: '200ms',
        }).check();
        assert.deepEqual(ready, { ready: true, message: 'status 200' });

        const response = await t.http.get(`${baseUrl}/health`, {
            tls: { ca: certificate.certPath },
        });
        response.expectStatus(200).expectJsonPath('$.status').toBe('ok');
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
    } finally {
        await close(server);
        await rm(root, { recursive: true, force: true });
    }
});

test('http plugin supports explicit local self-signed HTTPS mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-http-tls-self-signed-'));
    const certificate = generateLocalCertificate(root);
    const server = createHttpsServer({
        key: await readFile(certificate.keyPath),
        cert: await readFile(certificate.certPath),
    }, (_request, response) => {
        response.end('ok');
    });

    await listen(server);
    const baseUrl = `https://127.0.0.1:${String(serverPort(server))}`;

    smoke.use(httpPlugin());
    smoke.suite('https self signed', async (t) => {
        const response = await t.http.get(`${baseUrl}/health`, {
            tls: { selfSigned: true },
        });
        response.expectStatus(200);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
    } finally {
        await close(server);
        await rm(root, { recursive: true, force: true });
    }
});
