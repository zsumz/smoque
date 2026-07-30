import assert from 'node:assert/strict';
import { test } from 'vitest';

import { parseOptionalJson } from '../../../../dist/plugins/http/json.js';

test('optional HTTP JSON accepts structured bodies', () => {
    assert.deepEqual(parseOptionalJson('{"status":"ok"}'), { status: 'ok' });
});

test('optional HTTP JSON ignores empty and unstructured bodies', () => {
    assert.equal(parseOptionalJson(''), undefined);
    assert.equal(parseOptionalJson('not json'), undefined);
});
