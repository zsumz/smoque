import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('plugin resources are cleaned up automatically after success', async () => {
    const cleaned: string[] = [];

    smoke.use(
        definePlugin({
            name: '@example/resource-cleanup-plugin',
            register(registry) {
                registry.resource('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        cleaned.push('client');
                        await Promise.resolve();
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin resource success', async (t) => {
        await t.example.client();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.deepEqual(cleaned, ['client']);
});

test('plugin action-returned resources are cleaned up automatically after success', async () => {
    const cleaned: string[] = [];

    smoke.use(
        definePlugin({
            name: '@example/action-resource-cleanup-plugin',
            register(registry) {
                registry.action('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        cleaned.push('client');
                        await Promise.resolve();
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin action resource success', async (t) => {
        await t.example.client();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.deepEqual(cleaned, ['client']);
});

test('plugin action-returned managed resources are not cleaned up twice', async () => {
    const cleaned: string[] = [];
    const resource = {
        name: 'example-client',
        kind: 'example.client',
        async cleanup() {
            cleaned.push('client');
            await Promise.resolve();
        },
    };

    smoke.use(
        definePlugin({
            name: '@example/action-resource-single-cleanup-plugin',
            register(registry) {
                registry.resource('example.client', () => resource);
                registry.action('example.useClient', async (t) => await t.example.client());
            },
        }),
    );

    smoke.suite('plugin action managed resource', async (t) => {
        await t.example.useClient();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'passed');
    assert.deepEqual(cleaned, ['client']);
});
