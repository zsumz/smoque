import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('plugin resources attach on failure and clean up automatically', async () => {
    const attached: string[] = [];
    const cleaned: string[] = [];

    smoke.use(
        definePlugin({
            name: '@example/resource-failure-plugin',
            register(registry) {
                registry.resource('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        cleaned.push('client');
                        await Promise.resolve();
                    },
                    async attachOnFailure() {
                        attached.push('client');
                        await Promise.resolve();
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin resource failure', async (t) => {
        await t.example.client();
        throw new Error('suite failed');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'failed');
    assert.equal(result.suites[0]?.error?.message, 'suite failed');
    assert.deepEqual(attached, ['client']);
    assert.deepEqual(cleaned, ['client']);
});

test('plugin action-returned resources attach on failure and clean up automatically', async () => {
    const attached: string[] = [];
    const cleaned: string[] = [];

    smoke.use(
        definePlugin({
            name: '@example/action-resource-failure-plugin',
            register(registry) {
                registry.action('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        cleaned.push('client');
                        await Promise.resolve();
                    },
                    async attachOnFailure() {
                        attached.push('client');
                        await Promise.resolve();
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin action resource failure', async (t) => {
        await t.example.client();
        throw new Error('suite failed');
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'failed');
    assert.equal(result.suites[0]?.error?.message, 'suite failed');
    assert.deepEqual(attached, ['client']);
    assert.deepEqual(cleaned, ['client']);
});

test('plugin resource cleanup errors are reported as cleanup errors', async () => {
    smoke.use(
        definePlugin({
            name: '@example/resource-cleanup-error-plugin',
            register(registry) {
                registry.resource('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        await Promise.reject(new Error('cleanup failed'));
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin resource cleanup error', async (t) => {
        await t.example.client();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'failed');
    assert.equal(result.suites[0]?.cleanupErrors[0]?.message, 'cleanup failed');
});

test('plugin action-returned resource cleanup errors are reported as cleanup errors', async () => {
    smoke.use(
        definePlugin({
            name: '@example/action-resource-cleanup-error-plugin',
            register(registry) {
                registry.action('example.client', () => ({
                    name: 'example-client',
                    kind: 'example.client',
                    async cleanup() {
                        await Promise.reject(new Error('cleanup failed'));
                    },
                }));
            },
        }),
    );

    smoke.suite('plugin action resource cleanup error', async (t) => {
        await t.example.client();
    });

    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, 'failed');
    assert.equal(result.suites[0]?.cleanupErrors[0]?.message, 'cleanup failed');
});
