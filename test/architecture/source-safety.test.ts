import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    isJavaScriptModule,
} from '../../scripts/architecture/module/module-files.mts';
import {
    sourceSafetyMessage,
} from '../../scripts/architecture/module/source-safety-policy.mts';

test('unsafe TypeScript escape hatches have explicit failures', () => {
    assert.equal(
        sourceSafetyMessage('explicit-any'),
        'explicit any is forbidden in production source.',
    );
    assert.equal(
        sourceSafetyMessage('non-null-assertion'),
        'non-null assertions are forbidden in production source.',
    );
});

test('production JavaScript module extensions are recognized', () => {
    assert.equal(isJavaScriptModule('example.js'), true);
    assert.equal(isJavaScriptModule('example.mjs'), true);
    assert.equal(isJavaScriptModule('example.cjs'), true);
    assert.equal(isJavaScriptModule('example.ts'), false);
    assert.equal(isJavaScriptModule('example.json'), false);
});
