import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getBinTarget } from '../../../../dist/plugins/node/bin.js';

test('package bin helper supports string bins for scoped package basenames', () => {
    assert.equal(
        getBinTarget({ bin: './bin/tool.js' }, '@scope/tool', '@scope/tool'),
        './bin/tool.js',
    );
    assert.equal(
        getBinTarget({ bin: './bin/tool.js' }, '@scope/tool', 'tool'),
        './bin/tool.js',
    );
    assert.equal(
        getBinTarget({ bin: './bin/tool.js' }, '@scope/tool', 'other'),
        undefined,
    );
    assert.equal(
        getBinTarget({ bin: { tool: './bin/tool.js' } }, '@scope/tool', 'tool'),
        './bin/tool.js',
    );
    assert.equal(
        getBinTarget({ bin: { tool: 42 } }, '@scope/tool', 'tool'),
        undefined,
    );
});
