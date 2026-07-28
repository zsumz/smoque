export const legacyLineLimits: ReadonlyMap<string, number> = new Map([
    ['src/core/context/smoke-context.ts', 224],
    ['src/core/runner/suite-executor.ts', 213],
    ['src/plugins/compose/compose-project.ts', 193],
    ['src/plugins/http/client.ts', 333],
    ['src/plugins/http/fake-server.ts', 218],
    ['src/process.ts', 333],
    ['src/reporting/event-report-builder.ts', 293],
    ['src/reporting/junit-reporter.ts', 188],
    ['src/reporting/terminal-reporter.ts', 265],
]);

export const legacyGenericModules: ReadonlySet<string> = new Set([
    'src/types/common.ts',
]);

export const legacySourceIndexes: ReadonlySet<string> = new Set([
    'src/assertions/index.ts',
    'src/command/index.ts',
    'src/network/index.ts',
    'src/plugins/compose/index.ts',
    'src/plugins/http/index.ts',
    'src/plugins/node/index.ts',
    'src/plugins/postgres/index.ts',
    'src/types/index.ts',
]);
