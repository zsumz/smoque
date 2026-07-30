export function matchesTextPattern(
    value: string,
    pattern: string | RegExp,
): boolean {
    if (typeof pattern === 'string') {
        return value.includes(pattern);
    }

    pattern.lastIndex = 0;
    return pattern.test(value);
}

export function formatTextPattern(pattern: string | RegExp): string {
    return typeof pattern === 'string'
        ? JSON.stringify(pattern)
        : String(pattern);
}

export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
