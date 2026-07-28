export interface PublicEntrypoint {
    readonly packageSubpath: string;
    readonly runtimePath: string;
    readonly sourcePath: string;
    readonly typesPath: string;
}

export const publicEntrypoints: readonly PublicEntrypoint[] = Object.freeze([
    Object.freeze({
        packageSubpath: '.',
        runtimePath: './dist/index.js',
        sourcePath: 'src/index.ts',
        typesPath: './dist/index.d.ts',
    }),
    Object.freeze({
        packageSubpath: './plugin',
        runtimePath: './dist/plugin.js',
        sourcePath: 'src/plugin.ts',
        typesPath: './dist/plugin.d.ts',
    }),
]);
