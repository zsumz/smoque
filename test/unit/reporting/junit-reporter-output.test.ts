import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('createJUnitReporter writes skipped steps', async () => {
    let output = '';
    const reporter = createJUnitReporter({
        write(text) {
            output = text;
        },
    });

    smoke.suite('junit skip', async (t) => {
        await t.step('skip branch', () => t.skip('not useful here'));
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'passed');
    assert.match(output, /<testsuites name="smoque" tests="1" failures="0" skipped="1"/u);
    assert.match(output, /<testsuite name="junit skip" tests="1" failures="0" skipped="1"/u);
    assert.match(output, /<testcase classname="junit skip" name="skip branch"/u);
    assert.match(output, /<skipped message="not useful here" \/>/u);
});

test('createJUnitReporter writes user logs to system-out', async () => {
    let output = '';
    const reporter = createJUnitReporter({
        write(text) {
            output = text;
        },
    });

    smoke.suite('junit logs', async (t) => {
        await t.step('log step', async () => {
            await t.log('step note');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'passed');
    assert.match(output, /<system-out>step note<\/system-out>/u);
});

test('createJUnitReporter writes a report file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-junit-reporter-'));
    const reportPath = join(root, 'smoke-report.xml');

    try {
        smoke.suite('junit file report', () => undefined);

        const reporter = createJUnitReporter({ path: reportPath });
        const result = await runRegisteredSuites({
            repoRoot: root,
            eventSink: reporter,
        });
        const output = await readFile(reportPath, 'utf8');

        assert.equal(result.status, 'passed');
        assert.match(
            output,
            /<testsuite name="junit file report" tests="1" failures="0" skipped="0"/u,
        );
        assert.match(
            output,
            /<testcase classname="junit file report" name="junit file report"/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
