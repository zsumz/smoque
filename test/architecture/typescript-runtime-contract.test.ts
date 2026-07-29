import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtureConfig = path.join(
    root,
    'etc',
    'fixtures',
    'typescript-runtime',
    'tsconfig.json',
);
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

test('runtime TypeScript contract rejects non-erasable fixtures', () => {
    const result = spawnSync(
        process.execPath,
        [tsc, '--project', fixtureConfig, '--pretty', 'false'],
        {
            cwd: root,
            encoding: 'utf8',
        },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, output);
    for (const fixture of [
        'enum.ts',
        'namespace.ts',
        'parameter-property.ts',
    ]) {
        assert.match(
            output,
            new RegExp(`${fixture.replace('.', '\\.')}.*erasableSyntaxOnly`, 'u'),
        );
    }
    assert.match(
        output,
        /type-import\.ts.*must be imported using a type-only import/u,
    );
    assert.equal(result.signal, null);
});
