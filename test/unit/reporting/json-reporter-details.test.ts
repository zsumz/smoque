import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('createJsonReporter summarizes suites, steps, commands, artifacts, and events', async () => {
    let output = '';
    const reporter = createJsonReporter({
        includeEvents: true,
        write(text) {
            output = text;
        },
    });

    smoke.suite('json report smoke', async (t) => {
        await t.step('run command', async () => {
            const result = await t.cmd(process.execPath, [
                '-e',
                'console.log("hello"); console.error("warn");',
            ]);
            assert.equal(result.exitCode, 0);
            await t.attach.text('inline-note', 'attached');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });
    const report = reporter.report();
    const [suite] = report.suites;
    const [step] = suite?.steps ?? [];
    const [command] = step?.commands ?? [];
    const [artifact] = step?.artifacts ?? [];
    const parsedOutput: unknown = JSON.parse(output);

    assert.equal(result.status, 'passed');
    assert.equal(report.schemaVersion, 'smoque.report.v1');
    assert.equal(report.run.status, 'passed');
    assert.equal(suite?.name, 'json report smoke');
    assert.equal(suite.status, 'passed');
    assert.equal(step?.name, 'run command');
    assert.equal(command?.stdout, 'hello\n');
    assert.equal(command.stderr, 'warn\n');
    assert.equal(artifact?.name, 'inline-note');
    assert.equal(artifact.kind, 'text');
    assert.match(artifact.path, /inline-note/u);
    assert.equal(await readFile(artifact.path, 'utf8'), 'attached');
    assert.ok(report.events?.some((event) => event.type === 'run.finished'));
    assert.deepEqual(parsedOutput, report);
});

test('createJsonReporter records user logs', async () => {
    const reporter = createJsonReporter({ write: () => undefined });

    smoke.suite('json log report', async (t) => {
        await t.log('suite note');
        await t.step('log step', async () => {
            await t.log('step note');
        });
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });
    const report = reporter.report();
    const [suite] = report.suites;

    assert.equal(result.status, 'passed');
    assert.deepEqual(suite?.logs, [{ message: 'suite note' }]);
    assert.deepEqual(suite.steps[0]?.logs, [{ message: 'step note' }]);
});
