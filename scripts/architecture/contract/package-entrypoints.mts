import { publicEntrypoints } from './public-entrypoint-manifest.mts';
import {
    compareContractValue,
    readNestedProperty,
    readProperty,
} from './contract-values.mts';

export function inspectPackageEntrypoints(
    packageJson: unknown,
    typeConfig: unknown,
): string[] {
    const failures: string[] = [];
    const packageName = readProperty(packageJson, 'name');

    compareContractValue(
        failures,
        readProperty(packageJson, 'exports'),
        Object.fromEntries(publicEntrypoints.map((entrypoint) => [
            entrypoint.packageSubpath,
            {
                types: entrypoint.typesPath,
                default: entrypoint.runtimePath,
            },
        ])),
        'package.json exports do not match the public entrypoint manifest.',
    );
    compareContractValue(
        failures,
        readProperty(packageJson, 'types'),
        publicEntrypoints[0]?.typesPath,
        'package.json root types do not match the public entrypoint manifest.',
    );
    compareContractValue(
        failures,
        readProperty(packageJson, 'bin'),
        { smoque: 'dist/cli/main.js' },
        'package.json bin does not match the public CLI contract.',
    );

    const expectedPaths = typeof packageName === 'string'
        ? Object.fromEntries(publicEntrypoints.map((entrypoint) => [
            entrypoint.packageSubpath === '.'
                ? packageName
                : `${packageName}${entrypoint.packageSubpath.slice(1)}`,
            [entrypoint.sourcePath],
        ]))
        : undefined;
    compareContractValue(
        failures,
        readNestedProperty(typeConfig, ['compilerOptions', 'paths']),
        expectedPaths,
        'tsconfig.base.json paths do not match the public entrypoint manifest.',
    );
    return failures;
}
