import type { SmokeEvent, SmokeEventSink } from '../../events.js';

export async function emitSmokeEvent(eventSink: SmokeEventSink | undefined, event: SmokeEvent): Promise<void> {
    await eventSink?.emit(event);
}
