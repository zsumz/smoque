import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';
import { assertAllRedacted, captureReporters, escapeRegExp } from './redaction-reporters.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.redact scrubs command failures before reporters receive them', async () => {
    const secret = 'postgres://user:pass@example.test/app';
    const regexSecret = 'api-key-12345';
    const outputs = captureReporters();

    smoke.suite('redacted command', async (t) => {
        t.redact(secret);
        t.redact(/api-key-\d+/u);

        await t.step('fail with secret output', async () => {
            await t.cmd(process.execPath, [
                '-e',
                `
          console.log(${JSON.stringify(`stdout ${secret} ${regexSecret}`)});
          console.error(${JSON.stringify(`stderr ${secret} ${regexSecret}`)});
          process.exit(7);
        `,
            ]);
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: outputs.reporter,
    });

    assert.equal(result.status, 'failed');
    assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(secret), 'u'));
    assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(regexSecret), 'u'));
    assertAllRedacted(outputs.values(), secret);
    assertAllRedacted(outputs.values(), regexSecret);
    assert.match(outputs.terminal, /\[redacted\]/u);
    assert.match(outputs.json, /\[redacted\]/u);
    assert.match(outputs.junit, /\[redacted\]/u);
    assert.match(outputs.github, /\[redacted\]/u);
});
