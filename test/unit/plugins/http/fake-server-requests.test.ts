import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.fakeServer serves routes and captures requests', async () => {
    smoke.use(httpPlugin());
    smoke.suite('fake server', async (t) => {
        const fake = await t.http.fakeServer('webhook-provider');

        fake.post('/events').reply(202, { accepted: true });
        fake.patch('/events').reply(
            200,
            { updated: true },
            { 'x-fake-service': 'webhook' },
        );

        const response = await t.http.post(fake.url('/events?debug=1'), {
            json: { type: 'smoke.event', data: { id: 'evt_1' } },
            headers: { 'x-smoke-test': 'yes' },
        });

        response.expectStatus(202).expectJsonPath('$.accepted').toBe(true);
        assert.deepEqual(fake.requests().map((request) => request.path), ['/events']);
        fake
            .expectRequest('POST', '/events')
            .withHeader('content-type')
            .matching(/application\/json/u)
            .withHeader('x-smoke-test')
            .toBe('yes')
            .withJsonPath('$.type')
            .toBe('smoke.event')
            .withJsonPath('$.data.id')
            .toExist();

        const updated = await t.http.patch(fake.url('/events'), {
            json: { type: 'smoke.updated' },
        });

        updated
            .expectStatus(200)
            .expectHeader('x-fake-service')
            .toBe('webhook')
            .expectJsonPath('$.updated')
            .toBe(true);
        fake.expectRequest('PATCH', '/events').withJsonPath('$.type').toBe('smoke.updated');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});

test('http.fakeServer preserves UTF-8 characters split across request chunks', async () => {
    const body = 'before 🌊 after';

    smoke.use(httpPlugin());
    smoke.suite('chunked fake request', async (t) => {
        const fake = await t.http.fakeServer('chunked-webhook');
        fake.post('/events').reply(204);

        await sendChunkedRequest(fake.url('/events'), body);

        assert.equal(fake.requests()[0]?.body, body);
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});

async function sendChunkedRequest(url: string, body: string): Promise<void> {
    const encoded = Buffer.from(body);
    const request = httpRequest(url, { method: 'POST' });
    const responsePromise = once(request, 'response') as Promise<[IncomingMessage]>;

    request.write(encoded.subarray(0, 9));
    request.end(encoded.subarray(9));

    const [response] = await responsePromise;
    response.resume();
    await once(response, 'end');
}
