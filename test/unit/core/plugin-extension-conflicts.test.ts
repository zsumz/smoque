import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('plugin extension names cannot conflict with built-in context properties', () => {
    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/conflict-plugin',
                    register(registry) {
                        registry.action('fs.readText', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/conflict-plugin" registered action extension "fs\.readText" that conflicts with built-in context property "fs"/u,
    );
});

test('plugin extension names cannot be duplicated across plugins', () => {
    smoke.use(
        definePlugin({
            name: '@example/first-plugin',
            register(registry) {
                registry.action('example.echo', () => undefined);
            },
        }),
    );
    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/second-plugin',
                    register(registry) {
                        registry.action('example.echo', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/second-plugin" registered duplicate action extension "example\.echo"; already registered as action/u,
    );
});

test('plugin extension names cannot conflict across extension kinds', () => {
    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/kind-conflict-plugin',
                    register(registry) {
                        registry.resource('example.client', () => ({
                            name: 'example-client',
                            kind: 'example.client',
                            async cleanup() {
                                return Promise.resolve();
                            },
                        }));
                        registry.action('example.client', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/kind-conflict-plugin" registered duplicate action extension "example\.client"; already registered as resource/u,
    );
});

test('plugin extension names cannot conflict with nested action prefixes', () => {
    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/action-prefix-plugin',
                    register(registry) {
                        registry.action('example', () => undefined);
                        registry.action('example.child', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/action-prefix-plugin" registered action extension "example\.child" that conflicts with action extension "example"/u,
    );
});

test('plugin extension names cannot conflict with existing action leaves', () => {
    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/action-leaf-plugin',
                    register(registry) {
                        registry.action('example.child', () => undefined);
                        registry.action('example', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/action-leaf-plugin" registered action extension "example" that conflicts with action extension "example\.child"/u,
    );
});

test('plugin extension names reject cross-kind prefix conflicts', () => {
    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/resource-action-prefix-plugin',
                    register(registry) {
                        registry.resource('example.client', () => ({
                            name: 'example-client',
                            kind: 'example.client',
                            async cleanup() {
                                return Promise.resolve();
                            },
                        }));
                        registry.action('example.client.query', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/resource-action-prefix-plugin" registered action extension "example\.client\.query" that conflicts with resource extension "example\.client"/u,
    );

    assert.throws(
        () => {
            smoke.use(
                definePlugin({
                    name: '@example/probe-action-prefix-plugin',
                    register(registry) {
                        registry.probe('example.ready.deep', () => ({
                            description: 'ready',
                            async check() {
                                await Promise.resolve();
                                return { ready: true };
                            },
                        }));
                        registry.action('example.ready', () => undefined);
                    },
                }),
            );
        },
        /Plugin "@example\/probe-action-prefix-plugin" registered action extension "example\.ready" that conflicts with probe extension "example\.ready\.deep"/u,
    );
});
