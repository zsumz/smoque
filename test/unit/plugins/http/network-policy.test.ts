import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http network policy blocks external requests with redaction', async () => {
    smoke.use(httpPlugin());
    smoke.suite('blocked network', async (t) => {
        t.redact('api.example.test');
        t.net.policy({ external: 'block' });

        await t.http.get('https://api.example.test/private?token=secret');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });
    const error = result.suites[0]?.error;

    assert.equal(result.status, 'failed');
    assert.ok(error);
    assert.match(error.message, /Blocked external network request: GET \[redacted\]\/private/u);
    assert.ok(error.details);
    assert.equal(error.details.method, 'GET');
    assert.equal(error.details.host, '[redacted]');
    assert.equal(error.details.path, '/private');
});

test('http network policy allows fake local servers', async () => {
    smoke.use(httpPlugin());
    smoke.suite('local network', async (t) => {
        t.net.policy({ external: 'block' });
        const fake = await t.http.fakeServer('local-provider');

        fake.get('/health').reply(200, { ok: true });

        const response = await t.http.get(fake.url('/health'));
        response.expectStatus(200).expectJsonPath('$.ok').toBe(true);
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});

test('http TLS options still honor external network policy', async () => {
    smoke.use(httpPlugin());
    smoke.suite('https tls network policy', async (t) => {
        t.net.policy({ external: 'block' });

        await t.http.get('https://api.example.test/health', {
            tls: { selfSigned: true },
        });
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'failed');
    assert.match(
        result.suites[0]?.error?.message ?? '',
        /Blocked external network request/u,
    );
});
