import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'vitest';

import {
    createJsonReporter,
    resetSmokeRegistry,
    runRegisteredSuites,
    smoke,
} from '../../../../dist/core.js';
import httpPlugin from '../../../../dist/plugins/http.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('http.fakeServer missing request failures list received requests', async () => {
    const reporter = createJsonReporter({ write: () => undefined });

    smoke.use(httpPlugin());
    smoke.suite('fake server diagnostics', async (t) => {
        const fake = await t.http.fakeServer('diagnostic-webhook');

        fake.post('/actual').reply(202, { accepted: true });
        await t.http.post(fake.url('/actual'), {
            json: { type: 'wrong.event', data: { id: 'evt_1' } },
            headers: {
                authorization: 'Bearer secret-value',
                'x-smoke-test': 'diagnostics',
            },
        });

        fake.expectRequest('POST', '/events');
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });
    const error = result.suites[0]?.error;
    const artifact = reporter.report().suites[0]?.artifacts[0];

    assert.equal(result.status, 'failed');
    assert.ok(error);
    assert.match(error.message, /Expected captured request POST \/events, but none was received/u);
    assert.match(error.message, /Received requests:/u);
    assert.match(error.message, /1\. POST \/actual/u);
    assert.match(error.message, /authorization: \[redacted\]/u);
    assert.match(error.message, /x-smoke-test: diagnostics/u);
    assert.match(error.message, /"type":"wrong\.event"/u);
    assert.doesNotMatch(error.message, /secret-value/u);
    assert.ok(artifact);
    assert.equal(artifact.name, 'diagnostic-webhook-requests.txt');
    assert.match(await readFile(artifact.path, 'utf8'), /POST \/actual/u);
});
