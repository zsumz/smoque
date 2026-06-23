import { SmokeError } from './errors.js';
import type { DurationString } from './types.js';

export function parseDuration(value: DurationString | undefined, fallbackMs: number): number {
    if (!value) {
        return fallbackMs;
    }

    const match = /^(\d+)(ms|s|m)$/.exec(value);
    if (!match) {
        throw new SmokeError(`Invalid duration: ${value}`, { duration: value });
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
