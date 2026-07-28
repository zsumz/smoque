import assert from 'node:assert/strict';
import { test } from 'vitest';

import { shouldUseProcessGroup } from '../../../dist/process-tree.js';
import { withPlatform } from './process-tree-observation.js';

test('shouldUseProcessGroup follows the current platform', () => {
    withPlatform('linux', () => {
        assert.equal(shouldUseProcessGroup(), true);
    });

    withPlatform('darwin', () => {
        assert.equal(shouldUseProcessGroup(), true);
    });

    withPlatform('win32', () => {
        assert.equal(shouldUseProcessGroup(), false);
    });
});
