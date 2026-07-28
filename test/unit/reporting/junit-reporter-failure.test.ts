import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import {
    createJUnitReporter,
    resetSmokeRegistry,
    runRegisteredSuites,
    smoke,
} from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('createJUnitReporter writes CI-friendly failure XML', async () => {
    let output = '';
    const reporter = createJUnitReporter({
        write(text) {
            output = text;
        },
    });

    smoke.suite('junit fail & escape', async (t) => {
        await t.step('bad <command>', async () =>
            t.cmd(process.execPath, [
                '-e',
                'console.log("<before>"); console.error("broken & bad"); process.exit(3);',
            ]));
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.match(output, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
    assert.match(output, /<testsuites name="smoque" tests="1" failures="1" skipped="0"/u);
    assert.match(
        output,
        /<testsuite name="junit fail &amp; escape" tests="1" failures="1" skipped="0"/u,
    );
    assert.match(
        output,
        /<testcase classname="junit fail &amp; escape" name="bad &lt;command&gt;"/u,
    );
    assert.match(output, /<failure message="Command failed with exit code 3:/u);
    assert.match(output, /<system-out>&lt;before&gt;\n\s*<\/system-out>/u);
    assert.match(output, /<system-err>broken &amp; bad\n\s*<\/system-err>/u);
});
