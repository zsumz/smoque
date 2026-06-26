import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { SmokeError } from '../../errors.js';
import { getBinTarget } from './bin.js';
import {
    getExportEntry,
    getTypesPath,
    listExportedSubpaths,
    normalizeSubpaths,
} from './exports.js';
import { readInstalledPackage } from './package-json.js';

export interface NpmPackageExpectation {
    toExpose(subpaths: string | string[]): Promise<void>;
    toExposeOnly(subpaths: string | string[]): Promise<void>;
    toHaveBin(binName: string): Promise<void>;
    toHaveTypes(subpaths: string | string[]): Promise<void>;
}

export function createNpmPackageExpectation(
    fixtureRoot: string,
    packageName: string,
): NpmPackageExpectation {
    const packageRoot = join(fixtureRoot, 'node_modules', packageName);

    return {
        async toExpose(subpaths): Promise<void> {
            const metadata = await readInstalledPackage(packageRoot, packageName);
            const missing = normalizeSubpaths(subpaths).filter((subpath) => getExportEntry(metadata.packageJson, subpath) === undefined);

            if (missing.length > 0) {
                throw new SmokeError(`Expected package ${packageName} to expose subpaths: ${missing.join(', ')}`, {
                    packageName,
                    packageRoot,
                    missingExports: missing,
                    exports: metadata.packageJson.exports,
                });
            }
        },
        async toExposeOnly(subpaths): Promise<void> {
            const metadata = await readInstalledPackage(packageRoot, packageName);
            const expected = normalizeSubpaths(subpaths);
            const actual = listExportedSubpaths(metadata.packageJson);
            const missing = expected.filter((subpath) => !actual.includes(subpath));
            const unexpected = actual.filter((subpath) => !expected.includes(subpath));

            if (missing.length > 0 || unexpected.length > 0) {
                throw new SmokeError(`Expected package ${packageName} exports to match exactly.`, {
                    packageName,
                    packageRoot,
                    missingExports: missing,
                    unexpectedExports: unexpected,
                    exports: metadata.packageJson.exports,
                });
            }
        },
        async toHaveBin(binName): Promise<void> {
            const metadata = await readInstalledPackage(packageRoot, packageName);
            const binTarget = getBinTarget(metadata.packageJson, packageName, binName);
            if (binTarget === undefined) {
                throw new SmokeError(`Expected package ${packageName} to declare bin: ${binName}`, {
                    packageName,
                    packageRoot,
                    binName,
                    bin: metadata.packageJson.bin,
                });
            }

            const packageBinPath = join(packageRoot, binTarget);
            if (!await exists(packageBinPath)) {
                throw new SmokeError(`Expected package bin target to exist: ${binName}`, {
                    packageName,
                    packageRoot,
                    binName,
                    binTarget,
                    path: packageBinPath,
                });
            }

            const installedBinPath = join(fixtureRoot, 'node_modules', '.bin', binName);
            if (!await exists(installedBinPath)) {
                throw new SmokeError(`Expected installed package bin to exist: ${binName}`, {
                    packageName,
                    packageRoot,
                    binName,
                    binTarget,
                    path: installedBinPath,
                });
            }
        },
        async toHaveTypes(subpaths): Promise<void> {
            const metadata = await readInstalledPackage(packageRoot, packageName);
            const missing: string[] = [];

            for (const subpath of normalizeSubpaths(subpaths)) {
                const typePath = getTypesPath(metadata.packageJson, subpath);
                if (typePath === undefined) {
                    missing.push(subpath);
                    continue;
                }

                if (!await exists(join(packageRoot, typePath))) {
                    throw new SmokeError(`Expected package ${packageName} type declaration to exist for ${subpath}`, {
                        packageName,
                        packageRoot,
                        subpath,
                        types: typePath,
                        path: join(packageRoot, typePath),
                    });
                }
            }

            if (missing.length > 0) {
                throw new SmokeError(`Expected package ${packageName} to declare types for subpaths: ${missing.join(', ')}`, {
                    packageName,
                    packageRoot,
                    missingTypes: missing,
                    exports: metadata.packageJson.exports,
                    types: metadata.packageJson.types ?? metadata.packageJson.typings,
                });
            }
        },
    };
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
