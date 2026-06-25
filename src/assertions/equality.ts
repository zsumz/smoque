import { inspect, isDeepStrictEqual } from 'node:util';

export function valuesDeepEqual(actual: unknown, expected: unknown): boolean {
    return isDeepStrictEqual(actual, expected);
}

export function formatValue(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        const serialized = JSON.stringify(value) as string | undefined;
        return serialized ?? String(value);
    }

    return inspect(value, {
        breakLength: 80,
        depth: 5,
        sorted: true,
    });
}
