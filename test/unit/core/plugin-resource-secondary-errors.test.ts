import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('resource evidence and cleanup failures stay secondary to the suite failure', async () => {
    smoke.use(
        definePlugin({
            name: '@example/resource-secondary-errors-plugin',
            register(registry) {
                registry.resource('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        await Promise.reject(new Error('cleanup failed'));
                    },
                    async attachOnFailure() {
                        await Promise.reject(new Error('attach failed'));
                    },
                }));
            },
        }),
    );

    smoke.suite('resource secondary errors', async (t) => {
        await t.example.client();
        throw new Error('primary failure');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });
    const suite = result.suites[0];

    assert.equal(result.status, 'failed');
    assert.ok(suite);
    assert.equal(suite.error?.message, 'primary failure');
    assert.deepEqual(
        suite.cleanupErrors.map((error) => error.message),
        ['attach failed', 'cleanup failed'],
    );
});
