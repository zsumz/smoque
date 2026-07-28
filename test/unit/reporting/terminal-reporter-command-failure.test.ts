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

test('createTerminalReporter writes failure details for commands', async () => {
    let output = '';
    const reporter = createTerminalReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('terminal fail', async (t) => {
        await t.step('run bad command', async () =>
            t.cmd(process.execPath, [
                '-e',
                'console.log("before"); console.error("broken"); process.exit(9);',
            ]));
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.match(output, /FAIL run bad command/u);
    assert.match(output, /Failure: terminal fail > run bad command/u);
    assert.match(output, /CommandFailedError/u);
    assert.match(output, /Command:/u);
    assert.match(output, /Exit code:\n {2}9/u);
    assert.match(output, /stderr:\n {2}broken/u);
    assert.match(output, /stdout:\n {2}before/u);
});
