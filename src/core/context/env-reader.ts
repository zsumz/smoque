import { SmokeError } from '../../errors.js';
import { toPathRef } from '../../path-ref.js';
import type { PathRef, SmokeContext } from '../../types.js';

export function createEnvReader(redact: (value: string) => void = () => undefined): SmokeContext['env'] {
    return {
        optional(name): string | undefined {
            return process.env[name];
        },
        string(name, options = {}): string {
            const value = process.env[name] ?? options.default;

            if (value === undefined && options.required) {
                throw new SmokeError(`Missing required environment variable: ${name}`, { name });
            }

            if (options.redact && value !== undefined) {
                redact(value);
            }

            return value ?? '';
        },
        int(name, options = {}): number {
            const raw = process.env[name] ?? (options.default === undefined ? undefined : String(options.default));

            if (raw === undefined && options.required) {
                throw new SmokeError(`Missing required environment variable: ${name}`, { name });
            }

            const value = raw === undefined ? 0 : parseEnvInteger(name, raw);

            if (!Number.isInteger(value)) {
                throw new SmokeError(`Environment variable ${name} must be an integer.`, { name, value: raw });
            }
            if (options.min !== undefined && value < options.min) {
                throw new SmokeError(`Environment variable ${name} must be at least ${String(options.min)}.`, { name, value });
            }
            if (options.max !== undefined && value > options.max) {
                throw new SmokeError(`Environment variable ${name} must be at most ${String(options.max)}.`, { name, value });
            }

            return value;
        },
        path(name, options = {}): PathRef {
            const value = process.env[name] ?? options.default;

            if (value === undefined && options.required) {
                throw new SmokeError(`Missing required environment variable: ${name}`, { name });
            }

            return toPathRef(value ?? '.');
        },
    };
}

function parseEnvInteger(name: string, raw: string): number {
    const value = raw.trim();
    if (!/^[+-]?\d+$/u.test(value)) {
        throw new SmokeError(`Environment variable ${name} must be an integer.`, { name, value: raw });
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
        throw new SmokeError(`Environment variable ${name} must be an integer.`, { name, value: raw });
    }

    return parsed;
}
