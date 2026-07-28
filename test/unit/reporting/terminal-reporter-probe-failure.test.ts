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

test('createTerminalReporter writes probe timeout details', async () => {
    let output = '';
    const reporter = createTerminalReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('terminal probe fail', async (t) => {
        await t.step('start service', async () =>
            t.process.start(
                process.execPath,
                [
                    '-e',
                    `
                    console.log("booting service");
                    console.error("missing DATABASE_URL");
                    setInterval(() => undefined, 1000);
                    `,
                ],
                {
                    ready: {
                        description: 'service ready',
                        async check() {
                            await Promise.resolve();
                            return { ready: false, message: 'still booting' };
                        },
                    },
                    timeout: '1s',
                },
            ));
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.match(output, /FAIL start service/u);
    assert.match(output, /Failure: terminal probe fail > start service/u);
    assert.match(output, /ProbeTimeoutError/u);
    assert.match(output, /Details:/u);
    assert.match(output, /probe: service ready/u);
    assert.match(output, /lastMessage: still booting/u);
    assert.match(output, /stdout:\n {2}booting service/u);
    assert.match(output, /stderr:\n {2}missing DATABASE_URL/u);
});
