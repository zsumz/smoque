import type { SmokeEvent } from '../events.js';
import { applyEventToReport } from './event-report-reducer.js';
import { createEventReportSnapshot } from './event-report-snapshot.js';
import { createEventReportState } from './event-report-state.js';
import type {
    EventReportBuilderOptions,
    JsonSmokeReport,
} from './event-report-types.js';

export type {
    EventReportBuilderOptions,
    JsonArtifactReport,
    JsonCommandReport,
    JsonLogReport,
    JsonRunReport,
    JsonSmokeReport,
    JsonStepReport,
    JsonSuiteReport,
} from './event-report-types.js';

export class EventReportBuilder {
    private readonly state = createEventReportState();

    public apply(event: SmokeEvent): void {
        applyEventToReport(this.state, event);
    }

    public report(options: EventReportBuilderOptions = {}): JsonSmokeReport {
        return createEventReportSnapshot(this.state, options);
    }
}
