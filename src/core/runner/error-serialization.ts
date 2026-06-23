import { SmokeError } from '../../errors.js';
import type { SerializedSmokeError } from '../../events.js';

export function serializeError(error: unknown): SerializedSmokeError {
    if (error instanceof Error) {
        const serialized: SerializedSmokeError = {
            name: error.name,
            message: error.message,
        };

        if (error.stack) {
            serialized.stack = error.stack;
        }
        if (error instanceof SmokeError && error.details) {
            serialized.details = error.details;
        }

        return serialized;
    }

    return {
        name: 'Error',
        message: String(error),
    };
}
