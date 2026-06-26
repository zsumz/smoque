import type { IncomingHttpHeaders } from 'node:http';

export function headersToRecord(headers: IncomingHttpHeaders): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
            record[name.toLowerCase()] = value;
        } else if (Array.isArray(value)) {
            record[name.toLowerCase()] = value.join(', ');
        }
    }
    return record;
}

export function formatHeaderValue(name: string, value: string, maxLength: number): string {
    return isSensitiveHeader(name) ? '[redacted]' : truncate(value, maxLength);
}

export function truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isSensitiveHeader(name: string): boolean {
    return /authorization|cookie|token|secret|password|pass|key|credential/iu.test(name);
}
