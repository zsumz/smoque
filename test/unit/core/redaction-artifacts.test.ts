import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'vitest';

import { createJsonReporter, createTerminalReporter, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';
import { escapeRegExp } from './redaction-reporters.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('redaction applies to artifact metadata', async () => {
    const secret = 'artifact-token-789';
    let terminal = '';
    const reporter = createTerminalReporter({
        write(text) {
            terminal += text;
        },
    });

    smoke.suite('redacted artifact', async (t) => {
        t.redact(secret);

        await t.step('attach secret artifact name', async () => {
            await t.attach.text(`debug-${secret}`, 'attached text is not persisted yet');
            throw new Error('show artifacts');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.doesNotMatch(terminal, new RegExp(escapeRegExp(secret), 'u'));
    assert.match(terminal, /debug-\[redacted\]/u);
});

test('redaction applies to text artifact contents', async () => {
    const secret = 'artifact-content-token-789';
    const reporter = createJsonReporter({
        write() {
            // The structured report is inspected directly below.
        },
    });

    smoke.suite('redacted artifact contents', async (t) => {
        t.redact(secret);

        await t.step('attach secret artifact content', async () => {
            await t.attach.text('debug-output.txt', `token=${secret}`);
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });
    const [suite] = reporter.report().suites;
    const [step] = suite?.steps ?? [];
    const [artifact] = step?.artifacts ?? [];
    assert.ok(artifact);
    const content = await readFile(artifact.path, 'utf8');

    assert.equal(result.status, 'passed');
    assert.equal(content, 'token=[redacted]');
});
