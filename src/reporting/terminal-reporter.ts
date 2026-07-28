import type { SmokeEvent, SmokeEventSink } from '../events.js';
import { handleTerminalEvent } from './terminal-event-handler.js';
import { TerminalReportState } from './terminal-report-state.js';

export interface TerminalReporterOptions {
    write?: (text: string) => Promise<void> | void;
}

export interface TerminalReporter extends SmokeEventSink {
    finish(): Promise<void>;
}

export function createTerminalReporter(
    options: TerminalReporterOptions = {},
): TerminalReporter {
    return new TerminalReporterImpl(options);
}

class TerminalReporterImpl implements TerminalReporter {
    private readonly state = new TerminalReportState();
    private finished = false;

    constructor(private readonly options: TerminalReporterOptions) {}

    public async emit(event: SmokeEvent): Promise<void> {
        await handleTerminalEvent(
            this.state,
            event,
            async (text) => this.write(text),
            async () => this.finish(),
        );
    }

    public async finish(): Promise<void> {
        this.finished = true;
        return Promise.resolve();
    }

    private async write(text: string): Promise<void> {
        if (this.options.write) {
            await this.options.write(text);
            return;
        }
        process.stdout.write(text);
    }
}
