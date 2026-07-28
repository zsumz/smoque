import assert from 'node:assert/strict';
import { test } from 'vitest';
import { findDependencyCycles } from '../../scripts/architecture/dependency/find-dependency-cycles.mts';

test('dependency cycle inspection returns canonical unique cycles', () => {
    const graph: Map<string, readonly string[]> = new Map([
        ['src/a.ts', ['src/b.ts']],
        ['src/b.ts', ['src/c.ts']],
        ['src/c.ts', ['src/a.ts']],
        ['src/leaf.ts', []],
    ]);

    assert.deepEqual(findDependencyCycles(graph), [
        ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts'],
    ]);
});

test('dependency cycle inspection accepts an acyclic graph', () => {
    const graph: Map<string, readonly string[]> = new Map([
        ['src/a.ts', ['src/b.ts']],
        ['src/b.ts', []],
    ]);

    assert.deepEqual(findDependencyCycles(graph), []);
});
