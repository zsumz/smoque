import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function createPackageJson(): Record<string, unknown> {
    return {
        name: 'smoque-pack-fixture',
        version: '1.2.3',
        type: 'module',
        exports: './index.js',
        files: ['index.js'],
    };
}

export function createScriptPackageJson(): Record<string, unknown> {
    return {
        name: 'script-fixture',
        version: '1.2.3',
        type: 'module',
        scripts: {
            postinstall: 'node postinstall.cjs',
        },
        exports: './index.js',
        files: ['index.js', 'postinstall.cjs'],
    };
}

export function createSurfacePackageJson(): Record<string, unknown> {
    return {
        name: 'surface-fixture',
        version: '1.2.3',
        type: 'module',
        bin: {
            'surface-fixture': './dist/cli/main.js',
        },
        exports: {
            '.': {
                types: './dist/index.d.ts',
                default: './dist/index.js',
            },
            './plugin': {
                types: './dist/plugin.d.ts',
                default: './dist/plugin.js',
            },
        },
        types: './dist/index.d.ts',
        files: ['dist'],
    };
}

export async function writeBasicPackage(packageRoot: string): Promise<void> {
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify(createPackageJson(), null, 2),
        'utf8',
    );
    await writeFile(join(packageRoot, 'index.js'), 'export const ok = true;\n', 'utf8');
}

export async function writeLifecyclePackage(
    packageRoot: string,
    name: string,
    prepackSource = 'require("node:fs").writeFileSync("prepack-ran.txt", "yes");\n',
): Promise<void> {
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify({
            name,
            version: '1.2.3',
            type: 'module',
            scripts: {
                prepack: 'node prepack.cjs',
            },
            exports: './index.js',
            files: ['index.js', 'prepack.cjs'],
        }, null, 2),
        'utf8',
    );
    await writeFile(join(packageRoot, 'index.js'), 'export const ok = true;\n', 'utf8');
    await writeFile(join(packageRoot, 'prepack.cjs'), prepackSource, 'utf8');
}

export async function writeInstalledPackage(
    root: string,
    packageName: string,
    packageJson: Record<string, unknown>,
): Promise<string> {
    const packageRoot = join(root, 'node_modules', packageName);
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2),
        'utf8',
    );
    return packageRoot;
}
