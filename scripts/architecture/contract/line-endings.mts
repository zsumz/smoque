export function normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/gu, '\n');
}
