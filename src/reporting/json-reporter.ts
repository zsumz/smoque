import { writeFile } from 'node:fs/promises';

import { pathToString } from '../path-ref.js';
import type { SmokeEvent, SmokeEventSink } from '../events.js';
import type { PathRef } from '../types.js';
import { EventReportBuilder, type JsonSmokeReport } from './event-report-builder.js';

export interface JsonReporterOptions {
    path?: string | PathRef;
    pretty?: boolean;
    write?: (text: string) => Promise<void> | void;
    includeEvents?: boolean;
}

export interface JsonReporter extends SmokeEventSink {
    report(): JsonSmokeReport;
    finish(): Promise<void>;
}

export function createJsonReporter(options: JsonReporterOptions = {}): JsonReporter {
    return new JsonReporterImpl(options);
}

class JsonReporterImpl implements JsonReporter {
    private readonly reportBuilder = new EventReportBuilder();
    private finished = false;

    constructor(private readonly options: JsonReporterOptions) {}

    public async emit(event: SmokeEvent): Promise<void> {
        this.reportBuilder.apply(event);

        if (event.type === 'run.finished') {
            await this.finish();
        }
    }

    public report(): JsonSmokeReport {
        return this.reportBuilder.report({ includeEvents: this.options.includeEvents === true });
    }

    public async finish(): Promise<void> {
        if (this.finished) {
            return;
        }

        this.finished = true;
        const text = `${JSON.stringify(this.report(), null, this.options.pretty === false ? undefined : 2)}\n`;

        if (this.options.write) {
            await this.options.write(text);
            return;
        }

        if (this.options.path) {
            await writeFile(pathToString(this.options.path), text, 'utf8');
            return;
        }

        process.stdout.write(text);
    }
}
