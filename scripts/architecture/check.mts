import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectPublicApi } from './contract/public-api.mts';
import { inspectPublicEntrypointContract } from './contract/public-entrypoints.mts';
import { findDependencyCycles } from './dependency/find-dependency-cycles.mts';
import { createRuntimeDependencyGraph } from './dependency/runtime-dependency-graph.mts';
import {
    collectModuleFiles,
    relativePath,
} from './module/module-files.mts';
import {
    inspectModuleLayout,
} from './module/module-layout.mts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceRoot = path.join(root, 'src');
const inspectedRoots = [
    sourceRoot,
    path.join(root, 'test'),
    path.join(root, 'scripts'),
];
const failures: string[] = [];

const packageJson: unknown = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8'),
);
if (hasRuntimeDependencies(packageJson)) {
    failures.push('package.json: runtime dependencies require an accepted design decision.');
}

failures.push(...await inspectPublicEntrypointContract(root));
failures.push(...inspectPublicApi(root));

const inspectedFiles = (
    await Promise.all(inspectedRoots.map(collectModuleFiles))
).flat();
for (const file of inspectedFiles) {
    const source = await readFile(file, 'utf8');
    failures.push(...inspectModuleLayout(relativePath(root, file), countLines(source)));
}
const sourceFiles = await collectModuleFiles(sourceRoot);
const graph = await createRuntimeDependencyGraph(root, sourceRoot, sourceFiles);
for (const cycle of findDependencyCycles(graph)) {
    failures.push(`src: circular runtime dependency ${cycle.join(' -> ')}`);
}

if (failures.length > 0) {
    console.error('Architecture guardrails failed:\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exitCode = 1;
} else {
    console.log(
        `Architecture guardrails passed for ${String(inspectedFiles.length)} TypeScript modules.`,
    );
}

function hasRuntimeDependencies(value: unknown): boolean {
    return typeof value === 'object'
        && value !== null
        && 'dependencies' in value
        && typeof value.dependencies === 'object'
        && value.dependencies !== null
        && Object.keys(value.dependencies).length > 0;
}

function countLines(source: string): number {
    return source === '' ? 0 : source.split(/\r?\n/u).length - (source.endsWith('\n') ? 1 : 0);
}
