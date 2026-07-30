export function normalizePath(path: string): string {
    return path.replace(/\\/gu, '/');
}

export function normalizeRelativePattern(pattern: string): string {
    return normalizePath(pattern)
        .replace(/^\.\/+/u, '')
        .replace(/\/+$/u, '');
}
