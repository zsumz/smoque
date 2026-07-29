import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('plugin action data with a cleanup property remains ordinary data', async () => {
    const data = {
        cleanup: false,
        value: 'ordinary data',
    };

    smoke.use(
        definePlugin({
            name: '@example/action-data-plugin',
            register(registry) {
                registry.action('example.data', () => data);
            },
        }),
    );

    smoke.suite('plugin action data', async (t) => {
        assert.equal(await t.example.data(), data);
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});
