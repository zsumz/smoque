import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    normalizeLineEndings,
} from '../../scripts/architecture/contract/line-endings.mts';

test('public API reports compare independent of checkout line endings', () => {
    const report = '# API\n\n```ts\nexport interface Example {}\n```\n';

    assert.equal(
        normalizeLineEndings(report.replace(/\n/gu, '\r\n')),
        report,
    );
    assert.equal(
        normalizeLineEndings(report.replace(/\n/gu, '\r')),
        report,
    );
});
