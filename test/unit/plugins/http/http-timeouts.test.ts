import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { parseHttpDuration } from '../../../../dist/plugins/http/client-timeout.js';
import { close, listen, serverPort } from './http-server-lifecycle.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('HTTP timeouts retain the existing AbortError contract', async () => {
    const server = createServer(() => undefined);
    await listen(server);

    smoke.use(httpPlugin());
    smoke.suite('HTTP timeout', async (t) => {
        await t.http.get(
            `http://127.0.0.1:${String(serverPort(server))}/slow`,
            { timeout: '10ms' },
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: process.cwd() });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.equal(error.name, 'AbortError');
        assert.equal(error.message, 'This operation was aborted');
    } finally {
        await close(server);
    }
});

test('HTTP timeout parsing retains supported units and validation', () => {
    assert.equal(parseHttpDuration('12ms'), 12);
    assert.equal(parseHttpDuration('12s'), 12_000);
    assert.equal(parseHttpDuration('12m'), 720_000);
    assert.throws(
        () => parseHttpDuration('12'),
        /Invalid HTTP timeout: 12/u,
    );
});
