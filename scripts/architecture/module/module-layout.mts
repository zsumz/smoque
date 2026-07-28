import path from 'node:path';
import {
    legacyGenericModules,
    legacyLineLimits,
    legacySourceIndexes,
} from './architecture-debt.mts';

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
    const legacyLimit = legacyLineLimits.get(relative);

    if (lineCount > (legacyLimit ?? moduleLineLimit)) {
        failures.push(
            `${relative}: ${String(lineCount)} lines exceeds its `
            + `${String(legacyLimit ?? moduleLineLimit)}-line limit.`,
        );
    }
    if (
        forbiddenModuleNames.has(path.posix.basename(relative))
        && !legacyGenericModules.has(relative)
    ) {
        failures.push(`${relative}: generic junk-drawer module names are forbidden.`);
    }
    if (
        relative.startsWith('src/')
        && path.posix.basename(relative) === 'index.ts'
        && relative !== 'src/index.ts'
        && !legacySourceIndexes.has(relative)
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

export function inspectArchitectureDebt(
    files: readonly string[],
    lineCounts: ReadonlyMap<string, number>,
): string[] {
    const failures: string[] = [];
    const fileSet = new Set(files);

    for (const [file, limit] of legacyLineLimits) {
        if (!fileSet.has(file)) {
            failures.push(`${file}: remove stale line-limit debt for the deleted module.`);
        } else if ((lineCounts.get(file) ?? 0) <= moduleLineLimit) {
            failures.push(`${file}: remove resolved line-limit debt.`);
        } else if ((lineCounts.get(file) ?? 0) > limit) {
            failures.push(`${file}: legacy line debt increased beyond ${String(limit)}.`);
        }
    }
    for (const file of [...legacyGenericModules, ...legacySourceIndexes]) {
        if (!fileSet.has(file)) {
            failures.push(`${file}: remove stale architecture debt for the deleted module.`);
        }
    }
    return failures;
}
