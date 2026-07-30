import assert from 'node:assert/strict';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import {
    assertNetworkAllowed,
    createNetApi,
    isLocalHost,
} from '../../../../dist/network.js';

test('local host detection requires a local name or numeric address', () => {
    for (const host of [
        'localhost',
        '127.0.0.1',
        '127.255.255.254',
        '::1',
        '[::1]',
        '0.0.0.0',
    ]) {
        assert.equal(isLocalHost(host), true, host);
    }
    for (const host of [
        '127.attacker.example',
        '127.0.0.1.attacker.example',
    ]) {
        assert.equal(isLocalHost(host), false, host);
    }
});

test('network policy blocks external hosts and allows configured hosts', () => {
    const context = {};
    const net = createNetApi(context);

    net.policy({ external: 'block', allow: ['api.example.test'] });

    assert.doesNotThrow(() => {
        assertNetworkAllowed(context, 'GET', 'https://api.example.test/v1/health');
    });
    assert.doesNotThrow(() => {
        assertNetworkAllowed(context, 'GET', 'http://127.0.0.1:3000/health');
    });
    assert.doesNotThrow(() => {
        assertNetworkAllowed(context, 'GET', 'http://[::1]:3000/health');
    });

    assert.throws(
        () => {
            assertNetworkAllowed(context, 'POST', 'https://payments.example.test/charge');
        },
        (error) => {
            assert.ok(error instanceof SmokeError);
            assert.match(error.message, /Blocked external network request: POST payments\.example\.test\/charge/u);
            assert.equal(error.details?.method, 'POST');
            assert.equal(error.details.host, 'payments.example.test');
            assert.equal(error.details.path, '/charge');
            return true;
        },
    );
    for (const host of [
        '127.attacker.example',
        '127.0.0.1.attacker.example',
    ]) {
        assert.throws(
            () => {
                assertNetworkAllowed(context, 'GET', `https://${host}/health`);
            },
            /Blocked external network request/u,
        );
    }
});
