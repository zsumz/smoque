import { SmokeError } from '../errors.js';
import { readJsonPath } from '../json-path.js';
import { formatValue, valuesDeepEqual } from './equality.js';
import type { JsonPathExpectation } from './types.js';

export function createJsonPathExpectation(
    readJson: () => unknown,
    path: string,
    details: Record<string, unknown>,
): JsonPathExpectation {
    return {
        async toBe(expected): Promise<void> {
            const value = readJsonPath(await readJson(), path);
            if (value !== expected) {
                throw new SmokeError(`Expected JSON path ${path} to be ${JSON.stringify(expected)}.`, {
                    ...details,
                    jsonPath: path,
                    expected,
                    actual: value,
                });
            }
        },
        async toEqual(expected): Promise<void> {
            const value = readJsonPath(await readJson(), path);
            if (!valuesDeepEqual(value, expected)) {
                throw new SmokeError(`Expected JSON path ${path} to equal ${formatValue(expected)}.`, {
                    ...details,
                    jsonPath: path,
                    expected,
                    actual: value,
                });
            }
        },
        async toExist(): Promise<void> {
            const value = readJsonPath(await readJson(), path);
            if (value === undefined) {
                throw new SmokeError(`Expected JSON path ${path} to exist.`, {
                    ...details,
                    jsonPath: path,
                });
            }
        },
    };
}

export function parseStructuredJson(text: string, details: Record<string, unknown>): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new SmokeError('Expected valid JSON.', {
            ...details,
            excerpt: boundedTextExcerpt(text),
            cause: error instanceof Error ? error.message : String(error),
        });
    }
}

function boundedTextExcerpt(value: string): string {
    const trimmed = value.trim();
    return trimmed.length <= 500 ? trimmed : `${trimmed.slice(0, 500)}...`;
}
