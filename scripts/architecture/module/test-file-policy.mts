const testLikeName = /\.(?:spec|test)\.[^/]+$/u;

export function testFilePolicyFailure(relative: string): string | undefined {
    return testLikeName.test(relative) && !relative.endsWith('.test.ts')
        ? `${relative}: executable tests must use the *.test.ts extension.`
        : undefined;
}
