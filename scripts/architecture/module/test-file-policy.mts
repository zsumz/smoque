const executableTestName = /\.(?:spec|test)\.(?:[cm]?[jt]s|[jt]sx)$/u;

export function testFilePolicyFailure(relative: string): string | undefined {
    return executableTestName.test(relative) && !relative.endsWith('.test.ts')
        ? `${relative}: executable tests must use the *.test.ts extension.`
        : undefined;
}
