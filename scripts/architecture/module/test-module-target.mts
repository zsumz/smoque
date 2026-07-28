import path from 'node:path';

export function resolveTestSourceModule(
    root: string,
    file: string,
    specifier: string,
): string | undefined {
    if (!specifier.startsWith('.')) {
        return undefined;
    }
    const target = path.resolve(path.dirname(file), specifier);
    const sourceRoot = path.join(root, 'src');
    const distRoot = path.join(root, 'dist');
    if (target.startsWith(`${sourceRoot}${path.sep}`)) {
        return target.replace(/\.js$/u, '.ts');
    }
    if (target.startsWith(`${distRoot}${path.sep}`)) {
        return path.join(
            sourceRoot,
            path.relative(distRoot, target).replace(/\.js$/u, '.ts'),
        );
    }
    return undefined;
}
