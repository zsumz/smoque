import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.fakeServer serves supported response body shapes', async () => {
    smoke.use(httpPlugin());
    smoke.suite('fake server response shapes', async (t) => {
        const fake = await t.http.fakeServer('response-shapes');

        fake.get('empty').reply(204);
        fake.get('/text').reply(200, 'hello text');
        fake.get('/bytes').reply(200, new Uint8Array([115, 109, 111, 113]));
        fake.get('/json').reply(200, { ok: true });
        fake.get('/custom-json').reply(
            200,
            { ok: true },
            { 'content-type': 'application/vnd.smoque+json' },
        );

        const empty = await t.http.get(fake.url('empty?debug=1'));
        empty.expectStatus(204);
        assert.equal(empty.body, '');

        const text = await t.http.get(fake.url('/text'));
        text.expectStatus(200).expectHeader('content-type').toBe('text/plain; charset=utf-8');
        assert.equal(text.body, 'hello text');

        const bytes = await t.http.get(fake.url('/bytes'));
        bytes.expectStatus(200);
        assert.equal(bytes.body, 'smoq');

        const json = await t.http.get(fake.url('/json'));
        json
            .expectStatus(200)
            .expectHeader('content-type')
            .toBe('application/json; charset=utf-8')
            .expectJsonPath('$.ok')
            .toBe(true);

        const customJson = await t.http.get(fake.url('/custom-json'));
        customJson
            .expectStatus(200)
            .expectHeader('content-type')
            .toBe('application/vnd.smoque+json')
            .expectJsonPath('$.ok')
            .toBe(true);
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});
