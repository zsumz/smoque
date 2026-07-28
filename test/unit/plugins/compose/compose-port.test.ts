import assert from 'node:assert/strict';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { parsePublishedPort } from '../../../../dist/plugins/compose/ports.js';

test('compose published port parser handles platform-shaped output', () => {
    const ipv4 = parsePublishedPort('\n127.0.0.1:49154\n', 'web', 8080);
    assert.equal(ipv4.host, '127.0.0.1');
    assert.equal(ipv4.port, 49154);
    assert.equal(ipv4.url(), 'http://127.0.0.1:49154/');
    assert.equal(ipv4.url('health'), 'http://127.0.0.1:49154/health');
    assert.equal(ipv4.url('/secure', 'https'), 'https://127.0.0.1:49154/secure');

    const bracketedIpv6 = parsePublishedPort('[::1]:49155', 'web', 8080);
    assert.equal(bracketedIpv6.host, '::1');
    assert.equal(bracketedIpv6.port, 49155);
    assert.equal(bracketedIpv6.url(), 'http://[::1]:49155/');

    assert.equal(parsePublishedPort('0.0.0.0:49156', 'web', 8080).host, '127.0.0.1');
    assert.equal(parsePublishedPort('[::]:49157', 'web', 8080).host, '127.0.0.1');
    assert.equal(parsePublishedPort(':::49158', 'web', 8080).host, '127.0.0.1');
});

test('compose published port parser reports blank and malformed output', () => {
    const cases: ReadonlyArray<readonly [string, RegExp]> = [
        ['', /Docker Compose did not report a published port for api:5432\./u],
        ['\n  \n', /Docker Compose did not report a published port for api:5432\./u],
        ['not-a-port', /Could not parse Docker Compose published port: not-a-port/u],
        ['127.0.0.1:', /Could not parse Docker Compose published port: 127\.0\.0\.1:/u],
        ['127.0.0.1:abc', /Could not parse Docker Compose published port: 127\.0\.0\.1:abc/u],
    ];

    for (const [output, message] of cases) {
        assert.throws(
            () => parsePublishedPort(output, 'api', 5432),
            (error: unknown) => {
                assert.ok(error instanceof SmokeError);
                assert.match(error.message, message);
                assert.ok(error.details);
                assert.equal(error.details.service, 'api');
                assert.equal(error.details.containerPort, 5432);
                assert.equal(error.details.output, output);
                return true;
            },
        );
    }
});
