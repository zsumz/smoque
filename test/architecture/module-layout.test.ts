import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    inspectArchitectureDebt,
    inspectModuleLayout,
    moduleLineLimit,
} from '../../scripts/architecture/module/module-layout.mts';

test('new modules cannot exceed the shared line limit', () => {
    assert.deepEqual(inspectModuleLayout('src/example/new-module.ts', moduleLineLimit), []);
    assert.match(
        inspectModuleLayout('src/example/new-module.ts', moduleLineLimit + 1).join('\n'),
        /exceeds its 150-line limit/u,
    );
});

test('generic modules and undeclared nested indexes are rejected', () => {
    assert.match(
        inspectModuleLayout('src/example/helpers.ts', 10).join('\n'),
        /generic junk-drawer/u,
    );
    assert.match(
        inspectModuleLayout('src/example/index.ts', 10).join('\n'),
        /nested index modules are forbidden/u,
    );
});

test('deleted architecture debt must be removed from the manifest', () => {
    const stale = inspectArchitectureDebt([]);

    assert.match(stale.join('\n'), /remove stale architecture debt/u);
});
