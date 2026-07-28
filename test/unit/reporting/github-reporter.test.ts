import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import {
    createGitHubReporter,
    resetSmokeRegistry,
    runRegisteredSuites,
    smoke,
} from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('createGitHubReporter writes escaped failure annotations', async () => {
    let output = '';
    const reporter = createGitHubReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('github, suite', async (t) => {
        await t.step('bad: step', () => {
            throw new Error('broken % value\nnext line');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.match(
        output,
        /^::error file=.*github-reporter\.test\.ts,title=github%2C suite > bad%3A step::Error: broken %25 value%0Anext line$/mu,
    );
});
