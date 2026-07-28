export const sourceFacades = new Set([
    'src/command.ts',
    'src/expectations.ts',
    'src/reporters.ts',
    'src/types.ts',
]);

const allowedFacadeConsumers = new Set([
    'src/core.ts',
    'src/index.ts',
    'src/plugin.ts',
]);

export function facadeImportFailure(
    source: string,
    target: string,
    line: number,
    column: number,
): string | undefined {
    if (allowedFacadeConsumers.has(source) || !sourceFacades.has(target)) {
        return undefined;
    }
    return `${source}:${String(line)}:${String(column)} implementation modules must import `
        + `the concrete owner behind ${target}.`;
}
