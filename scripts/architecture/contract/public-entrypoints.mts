import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectPackageEntrypoints } from './package-entrypoints.mts';

export async function inspectPublicEntrypointContract(root: string): Promise<string[]> {
    const [packageJson, typeConfig] = await Promise.all([
        readJson(path.join(root, 'package.json')),
        readJson(path.join(root, 'tsconfig.base.json')),
    ]);
    return inspectPackageEntrypoints(packageJson, typeConfig);
}

async function readJson(file: string): Promise<unknown> {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
}
