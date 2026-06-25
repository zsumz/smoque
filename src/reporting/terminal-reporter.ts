import type { SmokeEvent, SmokeEventSink, SerializedSmokeError } from '../events.js';
import type { JsonArtifactReport, JsonCommandReport } from './event-report-builder.js';
import { excerptText, formatDetailValue, formatDuration, indent } from './format/terminal.js';

export interface TerminalReporterOptions {
    write?: (text: string) => Promise<void> | void;
}

export interface TerminalReporter extends SmokeEventSink {
    finish(): Promise<void>;
}

export function createTerminalReporter(options: TerminalReporterOptions = {}): TerminalReporter {
    return new TerminalReporterImpl(options);
}

class TerminalReporterImpl implements TerminalReporter {
    private readonly suites: Map<string, { name: string; steps: Map<string, string> }> = new Map();
    private readonly commands: Map<string, JsonCommandReport[]> = new Map();
    private readonly stepArtifacts: Map<string, JsonArtifactReport[]> = new Map();
    private readonly suiteArtifacts: Map<string, JsonArtifactReport[]> = new Map();
    private readonly failures: Array<{
        suite: string;
        step?: string;
        error: SerializedSmokeError;
        command?: JsonCommandReport;
        artifacts: JsonArtifactReport[];
    }> = [];
    private finished = false;

    constructor(private readonly options: TerminalReporterOptions) {}

    public async emit(event: SmokeEvent): Promise<void> {
        switch (event.type) {
            case 'run.started':
                await this.write('smoque\n\n');
                return;
            case 'suite.discovered':
                this.suites.set(event.suiteId, { name: event.name, steps: new Map() });
                return;
            case 'suite.started':
                this.ensureSuite(event.suiteId, event.name);
                await this.write(`${event.name}\n`);
                return;
            case 'step.started':
                this.ensureSuite(event.suiteId).steps.set(event.stepId, event.name);
                return;
            case 'step.passed':
                await this.write(
                    `  PASS ${this.stepName(event.stepId)} ${formatDuration(event.durationMs)}\n`,
                );
                return;
            case 'step.skipped':
                await this.write(
                    `  SKIP ${this.stepName(event.stepId)} ${formatDuration(event.durationMs)}\n`,
                );
                return;
            case 'step.failed': {
                const suite = this.suiteForStep(event.stepId);
                const stepName = this.stepName(event.stepId);
                const command = this.commands.get(event.stepId)?.at(-1);
                const suiteId = this.suiteIdForStep(event.stepId);
                const artifacts = [
                    ...suiteId ? this.suiteArtifacts.get(suiteId) ?? [] : [],
                    ...this.stepArtifacts.get(event.stepId) ?? [],
                ];
                const failure: {
                    suite: string;
                    step?: string;
                    error: SerializedSmokeError;
                    command?: JsonCommandReport;
                    artifacts: JsonArtifactReport[];
                } = {
                    suite: suite.name,
                    step: stepName,
                    error: event.error,
                    artifacts,
                };
                if (command) {
                    failure.command = command;
                }
                this.failures.push(failure);
                await this.write(`  FAIL ${stepName} ${formatDuration(event.durationMs)}\n`);
                return;
            }
            case 'suite.finished':
                if (this.ensureSuite(event.suiteId).steps.size === 0) {
                    await this.write(`  ${event.status.toUpperCase()} ${formatDuration(event.durationMs)}\n`);
                }
                return;
            case 'command.started':
                if (event.stepId) {
                    const command: JsonCommandReport = {
                        command: event.command,
                        args: [...event.args],
                        cwd: event.cwd,
                        stdout: '',
                        stderr: '',
                    };
                    const commands = this.commands.get(event.stepId) ?? [];
                    commands.push(command);
                    this.commands.set(event.stepId, commands);
                }
                return;
            case 'command.output': {
                const command = event.stepId ? this.commands.get(event.stepId)?.at(-1) : undefined;
                if (command) {
                    command[event.stream] += event.text;
                }
                return;
            }
            case 'command.finished': {
                const command = event.stepId ? this.commands.get(event.stepId)?.at(-1) : undefined;
                if (command) {
                    command.exitCode = event.exitCode;
                    command.durationMs = event.durationMs;
                }
                return;
            }
            case 'log.message':
                await this.write(`  LOG ${formatLogMessage(event.message)}\n`);
                return;
            case 'run.finished':
                await this.write(`\nResult: ${event.status} ${formatDuration(event.durationMs)}\n`);
                await this.writeFailures();
                await this.finish();
                return;
            case 'artifact.attached': {
                const artifact = {
                    name: event.name,
                    path: event.path,
                    kind: event.kind,
                };
                if (event.stepId) {
                    const artifacts = this.stepArtifacts.get(event.stepId) ?? [];
                    artifacts.push(artifact);
                    this.stepArtifacts.set(event.stepId, artifacts);
                    return;
                }
                if (event.suiteId) {
                    const artifacts = this.suiteArtifacts.get(event.suiteId) ?? [];
                    artifacts.push(artifact);
                    this.suiteArtifacts.set(event.suiteId, artifacts);
                }
                return;
            }
        }
    }

    public async finish(): Promise<void> {
        this.finished = true;
        return Promise.resolve();
    }

    private ensureSuite(
        suiteId: string,
        name = suiteId,
    ): { name: string; steps: Map<string, string> } {
        const existing = this.suites.get(suiteId);
        if (existing) {
            return existing;
        }

        const suite = { name, steps: new Map<string, string>() };
        this.suites.set(suiteId, suite);
        return suite;
    }

    private suiteForStep(stepId: string): { name: string; steps: Map<string, string> } {
        const suiteId = this.suiteIdForStep(stepId);
        if (suiteId) {
            return (
                this.suites.get(suiteId) ?? { name: '<unknown suite>', steps: new Map([[stepId, stepId]]) }
            );
        }

        return { name: '<unknown suite>', steps: new Map([[stepId, stepId]]) };
    }

    private suiteIdForStep(stepId: string): string | undefined {
        for (const [suiteId, suite] of this.suites) {
            if (suite.steps.has(stepId)) {
                return suiteId;
            }
        }
        return undefined;
    }

    private stepName(stepId: string): string {
        return this.suiteForStep(stepId).steps.get(stepId) ?? stepId;
    }

    private async writeFailures(): Promise<void> {
        for (const failure of this.failures) {
            const title = failure.step ? `${failure.suite} > ${failure.step}` : failure.suite;
            await this.write(`\nFailure: ${title}\n\n`);
            await this.write(`${failure.error.name}: ${failure.error.message}\n`);

            if (failure.command) {
                await this.write('\nCommand:\n');
                await this.write(`  ${[failure.command.command, ...failure.command.args].join(' ')}\n`);
                await this.write('\nWorking directory:\n');
                await this.write(`  ${failure.command.cwd}\n`);
                if (failure.command.exitCode !== undefined) {
                    await this.write('\nExit code:\n');
                    await this.write(`  ${String(failure.command.exitCode)}\n`);
                }
                if (failure.command.stderr) {
                    await this.write('\nstderr:\n');
                    await this.write(indent(excerptText(failure.command.stderr)));
                }
                if (failure.command.stdout) {
                    await this.write('\nstdout:\n');
                    await this.write(indent(excerptText(failure.command.stdout)));
                }
            } else if (failure.error.details) {
                await this.writeErrorDetails(failure.error.details);
            }

            await this.writeArtifacts(failure.artifacts);
        }
    }

    private async writeArtifacts(artifacts: JsonArtifactReport[]): Promise<void> {
        if (artifacts.length === 0) {
            return;
        }

        await this.write('\nArtifacts:\n');
        for (const artifact of artifacts) {
            await this.write(`  ${artifact.name}: ${artifact.path}\n`);
        }
    }

    private async writeErrorDetails(details: Record<string, unknown>): Promise<void> {
        const entries = Object.entries(details).filter(
            ([, value]) => value !== undefined && value !== '',
        );
        if (entries.length === 0) {
            return;
        }

        await this.write('\nDetails:\n');
        for (const [key, value] of entries) {
            if ((key === 'stdout' || key === 'stderr') && typeof value === 'string') {
                await this.write(`${key}:\n`);
                await this.write(indent(excerptText(value)));
            } else {
                await this.write(`  ${key}: ${formatDetailValue(value)}\n`);
            }
        }
    }

    private async write(text: string): Promise<void> {
        if (this.options.write) {
            await this.options.write(text);
            return;
        }
        process.stdout.write(text);
    }
}

function formatLogMessage(message: string): string {
    return excerptText(message).replace(/\r?\n/gu, '\n      ');
}
