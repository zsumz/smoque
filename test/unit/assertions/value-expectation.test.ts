import assert from 'node:assert/strict';
import { test } from 'vitest';

import { expect } from '../../../dist/core.js';

test('expect.value exposes the value matcher API', () => {
    expect('hello smoke').toContain('smoke');
    expect.value('hello smoke').toContain('smoke');
    expect.value(['package', 'service']).toContain('service');
    expect.value({ ok: true }).toEqual({ ok: true });

    assert.throws(
        () => {
            expect.value('hello smoke').toContain('missing');
        },
        /Expected "hello smoke" to contain "missing"/u,
    );
});

test('expect.value uses deep equality for toEqual', () => {
    const shared = { ok: true };

    expect.value(shared).toBe(shared);
    expect.value({ alpha: 1, beta: 2 }).toEqual({ beta: 2, alpha: 1 });
    expect.value({ present: undefined }).toEqual({ present: undefined });
    expect.value(['cli', { nested: ['json'] }]).toEqual(['cli', { nested: ['json'] }]);
    expect.value({ service: { ports: [3000, 3001] } }).toEqual({
        service: { ports: [3000, 3001] },
    });

    assert.throws(
        () => {
            expect.value({ ok: true }).toBe({ ok: true });
        },
        /Expected \{ ok: true \} to be \{ ok: true \}/u,
    );
    assert.throws(
        () => {
            expect.value({ nested: { ok: true } }).toEqual({ nested: { ok: false } });
        },
        /Expected \{ nested: \{ ok: true \} \} to equal \{ nested: \{ ok: false \} \}/u,
    );
    assert.throws(
        () => {
            expect.value({ present: undefined }).toEqual({});
        },
        /Expected \{ present: undefined \} to equal \{\}/u,
    );
});
