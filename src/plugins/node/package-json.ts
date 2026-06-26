import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { SmokeError } from '../../errors.js';
import { isRecord } from '../../shared/objects.js';

export { isRecord } from '../../shared/objects.js';

export interface InstalledPackage {
    packageJson: Record<string, unknown>;
}

export async function readInstalledPackage(
    packageRoot: string,
    packageName: string,
): Promise<InstalledPackage> {
    const packageJsonPath = join(packageRoot, 'package.json');
    let raw: string;
    try {
        raw = await readFile(packageJsonPath, 'utf8');
    } catch {
        throw new SmokeError(`Expected installed package to exist: ${packageName}`, {
            packageName,
            packageRoot,
            path: packageJsonPath,
        });
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new SmokeError(`Installed package has invalid package.json: ${packageName}`, {
            packageName,
            packageRoot,
            path: packageJsonPath,
        });
    }

    if (!isRecord(parsed)) {
        throw new SmokeError(`Installed package package.json must be an object: ${packageName}`, {
            packageName,
            packageRoot,
            path: packageJsonPath,
        });
    }

    return { packageJson: parsed };
}
