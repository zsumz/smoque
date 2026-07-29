import { SmokeError } from './errors.js';

export function processGroupError(
    error: unknown,
    processGroup: string,
    processName: string,
    cleanupError?: unknown,
): SmokeError {
    const details = error instanceof SmokeError ? error.details : undefined;
    const message = formatError(error);
    const cleanupErrors = cleanupError === undefined
        ? []
        : processGroupCleanupMessages(cleanupError);
    const wrapped = new SmokeError(
        `Process group "${processGroup}" failed starting "${processName}": ${message}`,
        {
            ...details ?? {},
            processGroup,
            processName,
            ...cleanupErrors.length === 0 ? {} : { cleanupErrors },
        },
    );

    if (error instanceof Error) {
        wrapped.name = error.name;
    }

    return wrapped;
}

export function processGroupStopError(
    errors: unknown[],
    processGroup: string,
): SmokeError {
    return new SmokeError(`Process group "${processGroup}" failed during cleanup.`, {
        processGroup,
        errors: errors.map(formatError),
    });
}

function processGroupCleanupMessages(error: unknown): string[] {
    if (
        error instanceof SmokeError
        && Array.isArray(error.details?.errors)
    ) {
        return error.details.errors.map(formatError);
    }
    return [formatError(error)];
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
