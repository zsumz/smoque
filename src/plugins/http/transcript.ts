import { formatHeaderValue, truncate } from './headers.js';

export interface HttpTranscriptInput {
    url: string;
    method: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    status: number;
    headers: Record<string, string>;
    body: string;
    error?: string;
}

export interface HttpResponseInput extends HttpTranscriptInput {
    json: unknown;
}

export interface TranscriptInputInit {
    url: string;
    method: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    status?: number;
    headers?: Record<string, string>;
    body?: string;
    json?: unknown;
    error?: string;
}

export function createTranscriptInput(input: TranscriptInputInit): HttpResponseInput {
    const transcript: HttpResponseInput = {
        url: input.url,
        method: input.method,
        requestHeaders: input.requestHeaders,
        status: input.status ?? 0,
        headers: input.headers ?? {},
        body: input.body ?? '',
        json: input.json,
    };

    if (input.requestBody !== undefined) {
        transcript.requestBody = input.requestBody;
    }
    if (input.error !== undefined) {
        transcript.error = input.error;
    }

    return transcript;
}

export function transcriptName(method: string, url: string): string {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/[^a-zA-Z0-9._-]+/gu, '-');
    const path = parsed.pathname.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');
    return `http-${method.toUpperCase()}-${host}${path ? `-${path}` : ''}.transcript.txt`;
}

export function formatHttpTranscript(input: HttpTranscriptInput): string {
    return [
        `${input.method.toUpperCase()} ${input.url}`,
        '',
        'Request headers:',
        formatTranscriptHeaders(input.requestHeaders),
        '',
        'Request body:',
        formatTranscriptBody(input.requestBody ?? ''),
        '',
        input.error === undefined ? `Response status: ${String(input.status)}` : `Request error: ${input.error}`,
        '',
        'Response headers:',
        formatTranscriptHeaders(input.headers),
        '',
        'Response body:',
        formatTranscriptBody(input.body),
        '',
    ].join('\n');
}

function formatTranscriptHeaders(headers: Record<string, string>): string {
    const entries = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) {
        return '  (none)';
    }

    return entries
        .slice(0, 20)
        .map(([name, value]) => `  ${name}: ${formatHeaderValue(name, value, 120)}`)
        .join('\n');
}

function formatTranscriptBody(body: string): string {
    const value = body.trim();
    return value === '' ? '  (empty)' : `  ${truncate(value, 2_000)}`;
}
