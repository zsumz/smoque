const allowedNonliteralDynamicImportModules = new Set([
    'src/cli/discovery/smoke-files.ts',
]);

export function nonliteralDynamicImportFailure(
    relativeSource: string,
): string | undefined {
    return allowedNonliteralDynamicImportModules.has(relativeSource)
        ? undefined
        : 'source modules must use literal dynamic import specifiers.';
}
