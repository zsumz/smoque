import { createExpectApi } from './core/expect-api.js';
import { SmokeRegistry } from './core/registry.js';
import { runRegisteredSuitesForRegistry } from './core/runner/run-registered-suites.js';
import { createSmokeApi } from './core/smoke-api.js';
import type { SmokeExpectApi } from './assertions/types.js';
import type { SmokeAuthoringApi } from './core/smoke-api.js';
import type { SmokeRunOptions, SmokeRunResult, SmokeSuite } from './types.js';

export type {
    ArchiveExpectation,
    CommandExpectation,
    DirectorySnapshotExpectation,
    DirectorySnapshotOptions,
    FileExpectation,
    JsonPathExpectation,
    SmokeExpectApi,
    TextSnapshotExpectation,
    ValueExpectation,
} from './assertions/types.js';

export type {
    Artifact,
    ArtifactSink,
    ChecksumAlgorithm,
    CommandOptions,
    CommandResult,
    DurationString,
    EnvReader,
    ExecutableOptions,
    FileSetExpectation,
    FixtureApi,
    FixtureTemplateOptions,
    ForbiddenRule,
    NetApi,
    NetworkPolicyOptions,
    PathRef,
    PortEnvValue,
    PortReserveOptions,
    PortsApi,
    ReservedPort,
    PollOptions,
    Probe,
    ProbeResult,
    ProcessGroup,
    ProcessGroupStartOptions,
    ProcessHandle,
    ProcessStartOptions,
    RedactOptions,
    SmokeContext,
    SmokeRunOptions,
    SmokeRunResult,
    SmokeResource,
    SmokeStepResult,
    SmokeSuite,
    SmokeSuiteResult,
    StepOptions,
    SuiteOptions,
    TcpApi,
    TcpReadyOptions,
    ToolDiscovery,
} from './types.js';

export type { SmokeEvent, SmokeEventSink, SerializedSmokeError } from './events.js';
export type { SmokePlugin, PluginRegistry } from './plugin.js';
export type { SmokeAuthoringApi } from './core/smoke-api.js';
export { definePlugin } from './plugin.js';
export { forbidden, listArchiveEntries } from './expectations.js';
export {
    createGitHubReporter,
    createJsonReporter,
    createJUnitReporter,
    createTerminalReporter,
} from './reporters.js';
export type {
    GitHubReporter,
    GitHubReporterOptions,
    JUnitReporter,
    JUnitReporterOptions,
    JsonArtifactReport,
    JsonCommandReport,
    JsonReporter,
    JsonReporterOptions,
    JsonRunReport,
    JsonSmokeReport,
    JsonStepReport,
    JsonSuiteReport,
    TerminalReporter,
    TerminalReporterOptions,
} from './reporters.js';

export const expect: SmokeExpectApi = createExpectApi();

export function getRegisteredSuites(): SmokeSuite[] {
    return registry.getSuites();
}

export function resetSmokeRegistry(): void {
    registry.reset();
}

export async function runRegisteredSuites(options: SmokeRunOptions = {}): Promise<SmokeRunResult> {
    return runRegisteredSuitesForRegistry(registry, options);
}

const registry = new SmokeRegistry();

export const smoke: SmokeAuthoringApi = createSmokeApi(registry);
