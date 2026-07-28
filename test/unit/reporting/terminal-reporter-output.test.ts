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

test('createTerminalReporter writes concise passing output', async () => {
    let output = '';
    const reporter = createTerminalReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('terminal pass', async (t) => {
        await t.step('check value', () => undefined);
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'passed');
    assert.match(output, /smoque/u);
    assert.match(output, /terminal pass/u);
    assert.match(output, /PASS check value/u);
    assert.match(output, /Result: passed/u);
});

test('createTerminalReporter writes user logs', async () => {
    let output = '';
    const reporter = createTerminalReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('terminal logs', async (t) => {
        await t.log('suite note');
        await t.step('log step', async () => {
            await t.log('step note');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'passed');
    assert.match(output, /LOG suite note/u);
    assert.match(output, /LOG step note/u);
    assert.match(output, /Result: passed/u);
});

test('createTerminalReporter writes skipped steps without failure details', async () => {
    let output = '';
    const reporter = createTerminalReporter({
        write(text) {
            output += text;
        },
    });

    smoke.suite('terminal skip', async (t) => {
        await t.step('skip branch', () => t.skip('not relevant'));
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'passed');
    assert.equal(result.suites[0]?.status, 'skipped');
    assert.match(output, /SKIP skip branch/u);
    assert.match(output, /Result: passed/u);
    assert.doesNotMatch(output, /FAIL skip branch/u);
    assert.doesNotMatch(output, /Failure: terminal skip > skip branch/u);
});
