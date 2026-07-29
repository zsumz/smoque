import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, readBody, serverPort } from './http-server-lifecycle.js';
import { generateLocalCertificate } from './local-certificate.js';

interface ReceivedRequest {
    method: string | undefined;
    body: string;
}

beforeEach(() => {
    resetSmokeRegistry();
});

test('redirects behave identically with fetch and custom TLS transports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-http-redirect-parity-'));
    const certificate = generateLocalCertificate(root);
    const httpReceived: ReceivedRequest[] = [];
    const httpsReceived: ReceivedRequest[] = [];
    const httpServer = createHttpServer(redirectHandler(httpReceived));
    const httpsServer = createHttpsServer({
        key: await readFile(certificate.keyPath),
        cert: await readFile(certificate.certPath),
    }, redirectHandler(httpsReceived));
    await listen(httpServer);
    await listen(httpsServer);

    smoke.use(httpPlugin());
    smoke.suite('redirect transport parity', async (t) => {
        const payload = { kind: 'smoke' };
        const plain = await t.http.post(
            `http://127.0.0.1:${String(serverPort(httpServer))}/start`,
            { json: payload },
        );
        const tls = await t.http.post(
            `https://127.0.0.1:${String(serverPort(httpsServer))}/start`,
            { json: payload, tls: { ca: certificate.certPath } },
        );
        plain.expectStatus(200);
        tls.expectStatus(200);
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.deepEqual(httpReceived, [{ method: 'POST', body: '{"kind":"smoke"}' }]);
        assert.deepEqual(httpsReceived, httpReceived);
    } finally {
        await close(httpServer);
        await close(httpsServer);
        await rm(root, { recursive: true, force: true });
    }
});

function redirectHandler(received: ReceivedRequest[]) {
    return (request: IncomingMessage, response: ServerResponse): void => {
        if (request.url === '/start') {
            response.statusCode = 307;
            response.setHeader('location', '/target');
            response.end();
            return;
        }
        readBody(request).then((body) => {
            received.push({ method: request.method, body });
            response.end('ok');
        }).catch((error: unknown) => {
            response.statusCode = 500;
            response.end(String(error));
        });
    };
}
