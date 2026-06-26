import archivePlugin from './plugins/archive.js';
import composePlugin from './plugins/compose.js';
import httpPlugin from './plugins/http.js';
import nodePlugin from './plugins/node.js';
import postgresPlugin from './plugins/postgres.js';
import { smoke } from './core.js';

export { expect, forbidden, listArchiveEntries, runRegisteredSuites, smoke } from './core.js';
export type {
    ArchiveExpectation,
    CommandExpectation,
    DirectorySnapshotExpectation,
    DirectorySnapshotOptions,
    FileExpectation,
    JsonPathExpectation,
    SmokeAuthoringApi,
    SmokeExpectApi,
    TextSnapshotExpectation,
    ValueExpectation,
} from './core.js';
export type { SmokePlugin } from './plugin.js';
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
    PollOptions,
    PortEnvValue,
    PortReserveOptions,
    PortsApi,
    Probe,
    ProbeResult,
    ProcessGroup,
    ProcessGroupStartOptions,
    ProcessHandle,
    ProcessStartOptions,
    RedactOptions,
    ReservedPort,
    SmokeContext,
    SmokeResource,
    SmokeRunOptions,
    SmokeRunResult,
    SmokeStepResult,
    SmokeSuite,
    SmokeSuiteResult,
    StepOptions,
    SuiteOptions,
    TcpApi,
    TcpReadyOptions,
    ToolDiscovery,
} from './types.js';
export type { ArchiveApi } from './plugins/archive.js';
export type {
    ComposeApi,
    ComposeCheckOptions,
    ComposeInfo,
    ComposeLogsOptions,
    ComposePortOptions,
    ComposeProject,
    ComposePublishedPort,
    ComposeService,
    ComposeServiceReadyOptions,
    ComposeUpOptions,
} from './plugins/compose.js';
export type { FakeHttpServer, HttpApi, HttpRequestOptions, HttpResponse } from './plugins/http.js';
export type { NpmApi, NpmFixture, NpmPackOptions, PackedArtifact } from './plugins/node.js';
export type {
    PostgresApi,
    PostgresCheckOptions,
    PostgresConnectOptions,
    PostgresDatabase,
    PostgresInfo,
    PostgresQueryResult,
    PostgresSqlOptions,
    PostgresStartOptions,
} from './plugins/postgres.js';

smoke.use(nodePlugin());
smoke.use(httpPlugin());
smoke.use(archivePlugin());
smoke.use(composePlugin());
smoke.use(postgresPlugin());
