import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { expect, getRegisteredSuites, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('registers suites with stable metadata', () => {
    smoke.suite('package smoke', { tags: ['package'] }, () => undefined);

    const [suite] = getRegisteredSuites();

    assert.ok(suite);
    assert.equal(suite.id, 'suite-1');
    assert.equal(suite.name, 'package smoke');
    assert.deepEqual(suite.tags, ['package']);
    assert.ok(suite.file);
    assert.match(suite.file, /registry\.test\.ts$/u);
});

test('rejects duplicate suite names', () => {
    smoke.suite('duplicate', () => undefined);

    assert.throws(() => {
        smoke.suite('duplicate', () => undefined);
    }, /Duplicate smoke suite name: duplicate/u);
});

test('waits for async plugin registration before running', async () => {
    let registered = false;

    smoke.use({
        name: '@example/async-plugin',
        async register(registry) {
            await Promise.resolve();
            registry.action('example.action', () => undefined);
            registered = true;
        },
    });

    smoke.suite('uses plugin', () => undefined);

    await runRegisteredSuites({ repoRoot: '/tmp/smoque-fixture' });

    assert.equal(registered, true);
});

test('supports a tiny value expectation surface', () => {
    expect('hello smoke').toContain('smoke');
    expect('abc123').toMatch(/\d+/u);
    expect(1).toBe(1);
    expect({ ok: true }).toEqual({ ok: true });
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();

    assert.throws(() => {
        expect('hello').toContain('goodbye');
    }, /Expected "hello" to contain "goodbye"/u);
});
