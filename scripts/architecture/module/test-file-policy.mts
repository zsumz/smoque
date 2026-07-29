const unsupportedTestExtension = /\.test\.(?:cjs|js|mjs|mts)$/u;

export function testFilePolicyFailure(relative: string): string | undefined {
    return unsupportedTestExtension.test(relative)
        ? `${relative}: executable tests must use the *.test.ts extension.`
        : undefined;
}
