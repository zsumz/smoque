import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import {
    createTerminalReporter,
    resetSmokeRegistry,
    runRegisteredSuites,
    smoke,
} from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('createTerminalReporter writes artifacts for failed steps', async () => {
    let output = '';
    const reporter = createTerminalReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('terminal artifact fail', async (t) => {
        await t.step('collect debug output', async () => {
            await t.attach.text('debug-note', 'fixture details');
            throw new Error('debug me');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.match(output, /Failure: terminal artifact fail > collect debug output/u);
    assert.match(output, /Artifacts:/u);
    assert.match(output, /debug-note: .*debug-note/u);
});
