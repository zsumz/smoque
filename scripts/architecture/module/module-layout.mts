import path from 'node:path';

export const moduleLineLimit = 150;

const forbiddenModuleNames = new Set([
    'common.mts',
    'common.ts',
    'config.mts',
    'config.ts',
    'helpers.mts',
    'helpers.ts',
    'utils.mts',
    'utils.ts',
]);

export function inspectModuleLayout(relative: string, lineCount: number): string[] {
    const failures: string[] = [];

    if (lineCount > moduleLineLimit) {
        failures.push(
            `${relative}: ${String(lineCount)} lines exceeds its `
            + `${String(moduleLineLimit)}-line limit.`,
        );
    }
    if (forbiddenModuleNames.has(path.posix.basename(relative))) {
        failures.push(`${relative}: generic junk-drawer module names are forbidden.`);
    }
    if (
        relative.startsWith('src/')
        && path.posix.basename(relative) === 'index.ts'
        && relative !== 'src/index.ts'
    ) {
        failures.push(
            `${relative}: add source entrypoints deliberately; nested index modules are forbidden.`,
        );
    }
    if (path.posix.dirname(relative) === 'test') {
        failures.push(`${relative}: tests belong in an owned feature directory.`);
    }
    if (
        path.posix.dirname(relative) === 'scripts/architecture'
        && relative !== 'scripts/architecture/check.mts'
    ) {
        failures.push(
            `${relative}: architecture internals belong in an owned domain directory.`,
        );
    }
    return failures;
}
