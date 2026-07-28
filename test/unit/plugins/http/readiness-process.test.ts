import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { reserveFreePort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.ready works as a process readiness probe', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-http-ready-'));
    const serverFile = join(root, 'server.cjs');
    const port = await reserveFreePort();

    await writeFile(
        serverFile,
        `
        const http = require("node:http");
        const server = http.createServer((_request, response) => {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ status: "ok" }));
        });
        server.listen(process.env.PORT, "127.0.0.1");
        `,
        'utf8',
    );

    smoke.use(httpPlugin());
    smoke.suite('http ready process', async (t) => {
        const app = await t.process.start(process.execPath, [serverFile], {
            env: { PORT: String(port) },
            ready: t.http.ready(
                `http://127.0.0.1:${String(port)}/health`,
                { timeout: '200ms' },
            ),
            timeout: '2s',
        });

        const response = await t.http.get(
            `http://127.0.0.1:${String(port)}/health`,
        );
        response.expectStatus(200).expectJsonPath('$.status').toBe('ok');
        await app.stop();
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });

        assert.equal(result.status, 'passed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
