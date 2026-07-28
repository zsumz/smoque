import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('plugin dotted actions and probes are exposed on the smoke context', async () => {
    smoke.use(
        definePlugin({
            name: '@example/context-plugin',
            register(registry) {
                registry.action('example.echo', (_t, value) => value);
                registry.probe('example.ready', (_t, message) => ({
                    description: `example ready: ${String(message)}`,
                    async check() {
                        await Promise.resolve();
                        return { ready: true, message: String(message) };
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin context', async (t) => {
        assert.equal(await t.example.echo('hello'), 'hello');

        const probe = t.example.ready('yes');
        assert.equal(probe.description, 'example ready: yes');
        assert.deepEqual(await probe.check(), { ready: true, message: 'yes' });
        assert.equal(typeof t.log, 'function');
        assert.equal(typeof t.log.contains, 'function');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
});
