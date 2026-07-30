import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    formatTextPattern,
    matchesTextPattern,
} from '../../../dist/shared/text-pattern.js';

test('text patterns match strings and reusable regular expressions', () => {
    const globalPattern = /ready/gu;

    assert.equal(matchesTextPattern('service ready', 'ready'), true);
    assert.equal(matchesTextPattern('service ready', globalPattern), true);
    assert.equal(matchesTextPattern('service ready', globalPattern), true);
    assert.equal(matchesTextPattern('service pending', globalPattern), false);
});

test('text patterns have stable diagnostic formatting', () => {
    assert.equal(formatTextPattern('ready'), '"ready"');
    assert.equal(formatTextPattern(/ready/u), '/ready/u');
});
