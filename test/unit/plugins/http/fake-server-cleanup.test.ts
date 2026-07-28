import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import type { FakeHttpServer } from '../../../../dist/plugins/http.js';
import httpPlugin from '../../../../dist/plugins/http.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.fakeServer reports missing routes and closes during cleanup', async () => {
    let fake: FakeHttpServer | undefined;

    smoke.use(httpPlugin());
    smoke.suite('fake server cleanup', async (t) => {
        fake = await t.http.fakeServer('missing-route');

        const response = await t.http.get(fake.url('/missing'));

        response.expectStatus(404);
        assert.match(response.body, /No fake HTTP route for GET \/missing/u);
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.ok(fake);
    const closedFake = fake;
    await assert.rejects(async () => fetch(closedFake.url('/missing')));
});
