const maximumTimerDelayMs = 2_147_483_647;

export function createHttpTimeoutSignal(value: string | undefined): AbortSignal | undefined {
    return !value
        ? undefined
        : AbortSignal.timeout(normalizeTimerDelay(parseHttpDuration(value)));
}

export function preserveHttpTimeoutError(
    error: unknown,
    signal: AbortSignal | undefined,
): unknown {
    if (signal?.reason !== error || !isTimeoutError(error)) {
        return error;
    }
    return new DOMException('This operation was aborted', 'AbortError');
}

export function parseHttpDuration(value: string): number {
    const match = /^(\d+)(ms|s|m)$/.exec(value);
    if (!match) {
        throw new Error(`Invalid HTTP timeout: ${value}`);
    }

    const amount = Number.parseInt(match[1] ?? '0', 10);
    const unit = match[2];

    if (unit === 'ms') {
        return amount;
    }
    if (unit === 's') {
        return amount * 1000;
    }
    return amount * 60_000;
}

function isTimeoutError(error: unknown): error is DOMException {
    return error instanceof DOMException && error.name === 'TimeoutError';
}

function normalizeTimerDelay(value: number): number {
    return Number.isFinite(value) && value >= 1 && value <= maximumTimerDelayMs
        ? value
        : 1;
}
