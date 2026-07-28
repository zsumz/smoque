import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import {
    createJsonReporter,
    resetSmokeRegistry,
    runRegisteredSuites,
    smoke,
} from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('createJsonReporter writes a JSON report file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-json-reporter-'));
    const reportPath = join(root, 'smoke-report.json');

    try {
        smoke.suite('json file report', () => undefined);

        const reporter = createJsonReporter({ path: reportPath, pretty: false });
        const result = await runRegisteredSuites({
            repoRoot: root,
            eventSink: reporter,
        });
        const output = await readFile(reportPath, 'utf8');

        assert.equal(result.status, 'passed');
        assert.match(output, /"schemaVersion":"smoque\.report\.v1"/u);
        assert.match(output, /"name":"json file report"/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('createJsonReporter records skipped steps', async () => {
    const reporter = createJsonReporter({ write: () => undefined });

    smoke.suite('json skip report', async (t) => {
        await t.step('skip branch', () => t.skip('not on this platform'));
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });
    const report = reporter.report();
    const [suite] = report.suites;

    assert.equal(result.status, 'passed');
    assert.equal(report.run.status, 'passed');
    assert.equal(suite?.status, 'skipped');
    assert.equal(suite.steps[0]?.status, 'skipped');
    assert.equal(suite.steps[0].skipReason, 'not on this platform');
});
