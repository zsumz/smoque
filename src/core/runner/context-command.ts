import { runCommand, type RunCommandInput } from '../../command/run-command.js';
import type { SmokeEventSink } from '../../events.js';
import type { PathRef } from '../../types/path-ref.js';

export async function runContextCommand(
    command: string,
    args: string[],
    options: RunCommandInput['options'],
    repoRoot: PathRef,
    stepId: string | undefined,
    eventSink: SmokeEventSink | undefined,
): Promise<Awaited<ReturnType<typeof runCommand>>> {
    const input: RunCommandInput = {
        command,
        args,
        repoRoot,
    };

    if (options) {
        input.options = options;
    }
    if (stepId) {
        input.stepId = stepId;
    }
    if (eventSink) {
        input.eventSink = eventSink;
    }

    return runCommand(input);
}
