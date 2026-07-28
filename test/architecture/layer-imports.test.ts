import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    layerImportFailure,
} from '../../scripts/architecture/module/layer-import-policy.mts';

test('declared lower-layer imports are accepted', () => {
    assert.equal(
        layerImportFailure('src/shared/env.ts', 'src/types/env.ts'),
        undefined,
    );
    assert.equal(
        layerImportFailure('src/core/runner.ts', 'src/assertions/types.ts'),
        undefined,
    );
    assert.equal(
        layerImportFailure('src/core/runner.ts', 'src/command/run-command.ts'),
        undefined,
    );
});

test('cross-layer shortcuts are rejected', () => {
    assert.equal(
        layerImportFailure('src/shared/env.ts', 'src/core/registry.ts'),
        'shared modules must not import the core layer.',
    );
    assert.equal(
        layerImportFailure('src/reporting/json.ts', 'src/plugins/http.ts'),
        'reporting modules must not import the plugins layer.',
    );
});

test('root composition modules remain explicit boundaries', () => {
    assert.equal(
        layerImportFailure('src/index.ts', 'src/plugins/http.ts'),
        undefined,
    );
    assert.equal(
        layerImportFailure('src/core/runner.ts', 'src/errors.ts'),
        undefined,
    );
});

test('new nested layers require a declared policy', () => {
    assert.equal(
        layerImportFailure('src/unknown/module.ts', 'src/types/context.ts'),
        'source layer "unknown" has no declared import policy.',
    );
});
