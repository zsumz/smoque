import assert from 'node:assert/strict';
import { test } from 'vitest';

import { formatCapturedRequests } from '../../../../dist/plugins/http/fake-request-expectations.js';

test('http.fakeServer formats captured requests for empty and large diagnostics', () => {
    assert.equal(formatCapturedRequests([]), '  (none)');

    const output = formatCapturedRequests([
        {
            method: 'POST',
            path: '/events',
            headers: {
                'aa-long': 'h'.repeat(130),
                authorization: 'Bearer secret',
                'header-01': '1',
                'header-02': '2',
                'header-03': '3',
                'header-04': '4',
                'header-05': '5',
                'header-06': '6',
                'header-07': '7',
                'header-08': '8',
                'header-09': '9',
                'header-10': '10',
                'header-11': '11',
            },
            body: '',
            json: undefined,
        },
        {
            method: 'PUT',
            path: '/large',
            headers: {},
            body: 'x'.repeat(520),
            json: undefined,
        },
    ]);

    assert.match(output, /1\. POST \/events/u);
    assert.ok(output.includes(`aa-long: ${'h'.repeat(120)}...`));
    assert.match(output, /authorization: \[redacted\]/u);
    assert.match(output, /header-10: 10/u);
    assert.doesNotMatch(output, /header-11/u);
    assert.doesNotMatch(output, /secret/u);
    assert.match(output, /body: \(empty\)/u);
    assert.match(output, /2\. PUT \/large/u);
    assert.ok(output.includes(`body: ${'x'.repeat(500)}...`));
});
