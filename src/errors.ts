export class SmokeError extends Error {
    public readonly details: Record<string, unknown> | undefined;

    constructor(message: string, details?: Record<string, unknown>) {
        super(message);
        this.name = 'SmokeError';
        this.details = details;
    }
}

export class CommandFailedError extends SmokeError {
    constructor(message: string, details: Record<string, unknown>) {
        super(message, details);
        this.name = 'CommandFailedError';
    }
}

export class ProbeTimeoutError extends SmokeError {
    constructor(message: string, details: Record<string, unknown>) {
        super(message, details);
        this.name = 'ProbeTimeoutError';
    }
}

export class UnsafePathError extends SmokeError {
    constructor(message: string, details: Record<string, unknown>) {
        super(message, details);
        this.name = 'UnsafePathError';
    }
}
