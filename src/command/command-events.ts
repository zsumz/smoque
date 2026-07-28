import type { SmokeEvent, SmokeEventSink } from '../events.js';

export async function emitCommandStarted(
    eventSink: SmokeEventSink | undefined,
    stepId: string | undefined,
    command: string,
    args: string[],
    cwd: string,
): Promise<void> {
    await emit(eventSink, withOptionalStepId(stepId, {
        type: 'command.started',
        command,
        args,
        cwd,
    }));
}

export async function emitCommandOutput(
    eventSink: SmokeEventSink | undefined,
    stepId: string | undefined,
    stream: 'stdout' | 'stderr',
    text: string,
): Promise<void> {
    await emit(eventSink, withOptionalStepId(stepId, {
        type: 'command.output',
        stream,
        text,
    }));
}

export async function emitCommandFinished(
    eventSink: SmokeEventSink | undefined,
    stepId: string | undefined,
    exitCode: number,
    durationMs: number,
): Promise<void> {
    await emit(eventSink, withOptionalStepId(stepId, {
        type: 'command.finished',
        exitCode,
        durationMs,
    }));
}

function withOptionalStepId(stepId: string | undefined, event: SmokeEvent): SmokeEvent {
    if (!stepId) {
        return event;
    }

    switch (event.type) {
        case 'command.started':
            return { ...event, stepId };
        case 'command.output':
            return { ...event, stepId };
        case 'command.finished':
            return { ...event, stepId };
        case 'artifact.attached':
        case 'log.message':
        case 'run.finished':
        case 'run.started':
        case 'step.failed':
        case 'step.passed':
        case 'step.skipped':
        case 'step.started':
        case 'suite.discovered':
        case 'suite.finished':
        case 'suite.started':
            return event;
    }
}

async function emit(eventSink: SmokeEventSink | undefined, event: SmokeEvent): Promise<void> {
    await eventSink?.emit(event);
}
