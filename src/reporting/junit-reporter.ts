import { writeFile } from 'node:fs/promises';

import type { SmokeEvent, SmokeEventSink } from '../events.js';
import { pathToString } from '../path-ref.js';
import type { PathRef } from '../types.js';
import { EventReportBuilder } from './event-report-builder.js';
import { renderJUnitReport } from './junit-xml.js';

export interface JUnitReporterOptions {
    path?: string | PathRef;
    write?: (text: string) => Promise<void> | void;
}

export interface JUnitReporter extends SmokeEventSink {
    finish(): Promise<void>;
}

export function createJUnitReporter(options: JUnitReporterOptions = {}): JUnitReporter {
    return new JUnitReporterImpl(options);
}

class JUnitReporterImpl implements JUnitReporter {
    private readonly reportBuilder = new EventReportBuilder();
    private finished = false;

    constructor(private readonly options: JUnitReporterOptions) {}

    public async emit(event: SmokeEvent): Promise<void> {
        this.reportBuilder.apply(event);
        if (event.type === 'run.finished') {
            await this.finish();
        }
    }

    public async finish(): Promise<void> {
        if (this.finished) {
            return;
        }

        this.finished = true;
        const xml = renderJUnitReport(this.reportBuilder.report());
        if (this.options.write) {
            await this.options.write(xml);
            return;
        }
        if (this.options.path) {
            await writeFile(pathToString(this.options.path), xml, 'utf8');
            return;
        }
        process.stdout.write(xml);
    }
}
