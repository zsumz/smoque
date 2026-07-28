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

test('legacy line debt may shrink but cannot grow', () => {
    assert.deepEqual(inspectModuleLayout('src/reporting/terminal-reporter.ts', 200), []);
    assert.match(
        inspectModuleLayout('src/reporting/terminal-reporter.ts', 266).join('\n'),
        /exceeds its 265-line limit/u,
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

test('resolved or deleted debt must be removed from the manifest', () => {
    const files = ['src/reporting/terminal-reporter.ts'];
    const resolved = inspectArchitectureDebt(
        files,
        new Map([['src/reporting/terminal-reporter.ts', moduleLineLimit]]),
    );

    assert.match(resolved.join('\n'), /remove resolved line-limit debt/u);
    assert.match(resolved.join('\n'), /remove stale/u);
});
