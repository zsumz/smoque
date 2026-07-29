import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';
import { generateLocalCertificate } from './local-certificate.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('both transports reject HTTPS-to-HTTP redirects before the target request', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-http-redirect-downgrade-'));
    const certificate = generateLocalCertificate(root);
    let targetRequests = 0;
    const target = createHttpServer((_request, response) => {
        targetRequests += 1;
        response.end('unsafe downgrade');
    });
    await listen(target);
    const source = createHttpsServer({
        key: await readFile(certificate.keyPath),
        cert: await readFile(certificate.certPath),
    }, (_request, response) => {
        response.statusCode = 302;
        response.setHeader(
            'location',
            `http://127.0.0.1:${String(serverPort(target))}/target`,
        );
        response.end();
    });
    await listen(source);

    const sourceUrl = `https://127.0.0.1:${String(serverPort(source))}/start`;
    await runFetchDowngrade(sourceUrl, certificate.certPath);

    smoke.use(httpPlugin());
    smoke.suite('redirect downgrade parity', async (t) => {
        await assert.rejects(
            t.http.get(sourceUrl, { tls: { ca: certificate.certPath } }),
            /Refusing HTTP redirect from https:\/\/ to http:\/\//u,
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
        assert.equal(targetRequests, 0);
    } finally {
        await close(source);
        await close(target);
        await rm(root, { recursive: true, force: true });
    }
});

async function runFetchDowngrade(url: string, caPath: string): Promise<void> {
    const fixture = fileURLToPath(
        new URL('./fetch-redirect-downgrade.ts', import.meta.url),
    );
    await new Promise<void>((resolve, reject) => {
        execFile(
            process.execPath,
            [fixture, url],
            { env: { ...process.env, NODE_EXTRA_CA_CERTS: caPath } },
            (error, stdout, stderr) => {
                if (error !== null) {
                    reject(new Error(`Fetch downgrade fixture failed: ${stderr || stdout}`));
                    return;
                }
                assert.match(
                    stdout,
                    /Refusing HTTP redirect from https:\/\/ to http:\/\//u,
                );
                resolve();
            },
        );
    });
}
