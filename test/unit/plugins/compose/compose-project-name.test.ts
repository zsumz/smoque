import assert from 'node:assert/strict';
import { test } from 'vitest';

import { SmokeError } from '../../../../dist/errors.js';
import { normalizeProjectName } from '../../../../dist/plugins/compose/project-name.js';

test('compose project names normalize common input and reject unusable names', () => {
    assert.equal(normalizeProjectName(' Smoke Demo!! '), 'smoke-demo');
    assert.equal(normalizeProjectName('UPPER_case-123'), 'upper_case-123');
    assert.equal(normalizeProjectName('billing/api:smoke'), 'billing-api-smoke');
    assert.equal(normalizeProjectName('A'.repeat(80)), 'a'.repeat(63));

    for (const projectName of ['', '   ', '!!!']) {
        assert.throws(
            () => normalizeProjectName(projectName),
            (error: unknown) => {
                assert.ok(error instanceof SmokeError);
                assert.match(error.message, /Invalid Docker Compose project name:/u);
                assert.ok(error.details);
                assert.equal(error.details.projectName, projectName);
                assert.match(
                    String(error.details.expected),
                    /lowercase letters, digits, dashes, or underscores; must start with a letter or digit/u,
                );
                return true;
            },
        );
    }
});
