import { readFile } from 'node:fs/promises';

export async function readPackageVersion(): Promise<string> {
    const packageJsonUrl = new URL('../../../package.json', import.meta.url);
    const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as { version?: unknown };

    return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
}
