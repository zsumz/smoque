import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import type { SmokeRunResult } from '../../../../dist/types/suite.js';
import type { CapturedRequestExpectation } from '../../../../dist/plugins/http.js';
import httpPlugin from '../../../../dist/plugins/http.js';

interface FailureScenario {
    run: (expectation: CapturedRequestExpectation) => unknown;
    message: RegExp;
}

test('http.fakeServer request expectation failures include captured context', async () => {
    const scenarios: FailureScenario[] = [
        {
            run: (expectation) => expectation.withHeader('x-missing'),
            message: /Expected request header x-missing to exist\./u,
        },
        {
            run: (expectation) => expectation.withHeader('x-smoke-test').toBe('expected'),
            message: /Expected request header x-smoke-test to be "expected", got "actual"\./u,
        },
        {
            run: (expectation) => expectation.withHeader('x-smoke-test').matching(/^expected$/u),
            message: /Expected request header x-smoke-test to match \/\^expected\$\/u, got "actual"\./u,
        },
        {
            run: (expectation) => expectation.withJsonPath('$.missing').toExist(),
            message: /Expected captured request JSON path \$\.missing to exist\./u,
        },
        {
            run: (expectation) => expectation.withJsonPath('$.type').toBe('expected.event'),
            message: /Expected captured request JSON path \$\.type to be "expected\.event", got "actual\.event"\./u,
        },
    ];

    for (const scenario of scenarios) {
        const result = await runFakeRequestExpectationFailure(scenario.run);
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(error.message, scenario.message);
        assert.match(error.message, /Captured request:/u);
        assert.match(error.message, /POST \/events/u);
        assert.match(error.message, /x-smoke-test: actual/u);
        assert.match(error.message, /"type":"actual\.event"/u);
    }
});

async function runFakeRequestExpectationFailure(
    run: FailureScenario['run'],
): Promise<SmokeRunResult> {
    resetSmokeRegistry();
    smoke.use(httpPlugin());
    smoke.suite('fake server expectation failure', async (t) => {
        const fake = await t.http.fakeServer('request-expectation-failure');

        fake.post('events').reply(202);
        await t.http.post(fake.url('events?debug=1'), {
            json: { type: 'actual.event', data: { id: 'evt_1' } },
            headers: { 'x-smoke-test': 'actual' },
        });

        run(fake.expectRequest('post', 'events'));
    });

    return runRegisteredSuites({ repoRoot: process.cwd() });
}
