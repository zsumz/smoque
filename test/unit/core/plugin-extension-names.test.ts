import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { definePlugin, resetSmokeRegistry, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('plugin extension names reject unsafe dotted parts', () => {
    for (const name of ['__proto__.x', 'constructor.x', 'prototype.x', 'example..x', '']) {
        assert.throws(
            () => {
                smoke.use(
                    definePlugin({
                        name: `@example/invalid-${name || 'empty'}`,
                        register(registry) {
                            registry.action(name, () => undefined);
                        },
                    }),
                );
            },
            /registered invalid action extension/u,
        );
    }
});
