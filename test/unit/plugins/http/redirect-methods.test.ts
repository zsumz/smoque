import assert from 'node:assert/strict';
import { test } from 'vitest';

import { redirectRequest } from '../../../../dist/plugins/http/client-redirect.js';

const body = JSON.stringify({ ok: true });

test.each([
    { status: 301, method: 'POST', nextMethod: 'GET', keepsBody: false },
    { status: 302, method: 'POST', nextMethod: 'GET', keepsBody: false },
    { status: 301, method: 'PUT', nextMethod: 'PUT', keepsBody: true },
    { status: 302, method: 'PATCH', nextMethod: 'PATCH', keepsBody: true },
    { status: 303, method: 'PUT', nextMethod: 'GET', keepsBody: false },
    { status: 303, method: 'HEAD', nextMethod: 'HEAD', keepsBody: true },
    { status: 307, method: 'POST', nextMethod: 'POST', keepsBody: true },
    { status: 308, method: 'POST', nextMethod: 'POST', keepsBody: true },
])(
    'HTTP $status redirects $method to $nextMethod with body retention $keepsBody',
    ({ status, method, nextMethod, keepsBody }) => {
        const headers = new Headers({
            authorization: 'Bearer secret',
            'content-type': 'application/json',
        });
        const redirected = redirectRequest(
            {
                method,
                url: 'https://source.example/start',
                headers,
                body,
            },
            {
                status,
                headers: { location: 'https://target.example/next' },
            },
        );

        assert.ok(redirected);
        assert.equal(redirected.method, nextMethod);
        assert.equal(redirected.body, keepsBody ? body : undefined);
        assert.equal(
            redirected.headers.get('content-type'),
            keepsBody ? 'application/json' : null,
        );
        assert.equal(redirected.headers.get('authorization'), null);
    },
);

test('non-redirect responses and redirects without locations return no next request', () => {
    const request = {
        method: 'GET',
        url: 'https://source.example/start',
        headers: new Headers(),
        body: undefined,
    };

    assert.equal(
        redirectRequest(request, { status: 200, headers: { location: '/next' } }),
        undefined,
    );
    assert.equal(
        redirectRequest(request, { status: 302, headers: {} }),
        undefined,
    );
});
