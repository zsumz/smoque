export function compareContractValue(
    failures: string[],
    actual: unknown,
    expected: unknown,
    message: string,
): void {
    if (JSON.stringify(canonicalize(actual)) !== JSON.stringify(canonicalize(expected))) {
        failures.push(message);
    }
}

export function readProperty(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null && key in value
        ? value[key as keyof typeof value]
        : undefined;
}

export function readNestedProperty(value: unknown, keys: readonly string[]): unknown {
    return keys.reduce<unknown>((current, key) => readProperty(current, key), value);
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalize(child)]),
    );
}
