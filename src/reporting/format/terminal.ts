export function formatDuration(durationMs: number): string {
    if (durationMs < 1000) {
        return `${String(durationMs)}ms`;
    }
    return `${(durationMs / 1000).toFixed(1)}s`;
}

export function excerptText(text: string, maxLength = 2000): string {
    if (text.length <= maxLength) {
        return text.endsWith('\n') ? text : `${text}\n`;
    }
    return `${text.slice(0, maxLength)}\n... truncated ...\n`;
}

export function indent(text: string): string {
    return text
        .split('\n')
        .map((line) => line ? `  ${line}` : '')
        .join('\n');
}

export function formatDetailValue(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
        return String(value);
    }
    return JSON.stringify(value);
}
