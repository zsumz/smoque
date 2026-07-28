import path from 'node:path';

export function resolveImportedSourceModule(
    sourceRoot: string,
    file: string,
    specifier: string,
): string | undefined {
    if (!specifier.startsWith('.')) {
        return undefined;
    }
    const target = path.resolve(
        path.dirname(file),
        specifier.replace(/\.js$/u, '.ts'),
    );
    return target.startsWith(`${sourceRoot}${path.sep}`) ? target : undefined;
}
