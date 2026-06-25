import { SmokeError } from '../errors.js';
import { formatValue, valuesDeepEqual } from './equality.js';
import type { ValueExpectation } from './types.js';

export function createValueExpectation<T>(value: T): ValueExpectation<T> {
    return {
        toBe(expected): void {
            if (!Object.is(value, expected)) {
                throw new SmokeError(`Expected ${formatValue(value)} to be ${formatValue(expected)}.`);
            }
        },
        toEqual(expected): void {
            if (!valuesDeepEqual(value, expected)) {
                throw new SmokeError(`Expected ${formatValue(value)} to equal ${formatValue(expected)}.`);
            }
        },
        toContain(expected): void {
            if (typeof value === 'string') {
                if (!value.includes(String(expected))) {
                    throw new SmokeError(`Expected ${formatValue(value)} to contain ${formatValue(expected)}.`);
                }
                return;
            }

            if (Array.isArray(value)) {
                if (!value.includes(expected)) {
                    throw new SmokeError(`Expected array to contain ${formatValue(expected)}.`);
                }
                return;
            }

            throw new SmokeError('toContain supports strings and arrays.');
        },
        toMatch(pattern): void {
            if (typeof value !== 'string' || !pattern.test(value)) {
                throw new SmokeError(`Expected ${formatValue(value)} to match ${String(pattern)}.`);
            }
        },
        toBeTruthy(): void {
            if (!value) {
                throw new SmokeError(`Expected ${formatValue(value)} to be truthy.`);
            }
        },
        toBeFalsy(): void {
            if (value) {
                throw new SmokeError(`Expected ${formatValue(value)} to be falsy.`);
            }
        },
    };
}
