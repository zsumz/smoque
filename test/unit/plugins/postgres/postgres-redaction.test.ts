import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { SmokeContext } from '../../../../dist/core.js';
import { redactUrl } from '../../../../dist/plugins/postgres/psql.js';

test('Postgres URL redaction decodes passwords and tolerates malformed URLs', () => {
    const redacted: string[] = [];
    const context = {
        redact(value: string) {
            redacted.push(value);
        },
    } as unknown as SmokeContext;
    const url = 'postgres://user:p%40ss@127.0.0.1:5432/app';

    redactUrl(context, url);
    redactUrl(context, 'not a URL');

    assert.deepEqual(redacted, [
        url,
        'p@ss',
        'not a URL',
    ]);
});
