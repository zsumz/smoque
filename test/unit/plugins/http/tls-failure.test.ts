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

test('http plugin distinguishes TLS verification from response failures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-http-tls-failure-'));
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
    smoke.suite('https tls failure', async (t) => {
        await t.http.get(`${baseUrl}/health`, { tls: {} });
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.equal(error.name, 'SmokeError');
        assert.match(error.message, /TLS verification failed/u);
        assert.ok(error.details);
        assert.equal(error.details.kind, 'tls');
        assert.equal(error.details.method, 'GET');
        assert.match(String(error.details.code), /SELF_SIGNED|VERIFY|SIGNATURE/u);
    } finally {
        await close(server);
        await rm(root, { recursive: true, force: true });
    }
});
