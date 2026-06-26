import { readJsonPath } from '../../json-path.js';
import { formatHeaderValue, truncate } from './headers.js';

export interface CapturedRequest {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string;
    json: unknown;
}

export interface CapturedRequestExpectation {
    withHeader(name: string): HeaderExpectation;
    withJsonPath(path: string): CapturedJsonPathExpectation;
}

export interface HeaderExpectation {
    matching(pattern: RegExp): CapturedRequestExpectation;
    toBe(expected: string): CapturedRequestExpectation;
}

export interface CapturedJsonPathExpectation {
    toBe(expected: unknown): CapturedRequestExpectation;
    toExist(): CapturedRequestExpectation;
}

export function createCapturedRequestExpectation(
    request: CapturedRequest,
): CapturedRequestExpectation {
    return new CapturedRequestExpectationImpl(request);
}

export function formatCapturedRequests(requests: CapturedRequest[]): string {
    if (requests.length === 0) {
        return '  (none)';
    }

    return requests
        .map((request, index) => formatCapturedRequest(request, `  ${String(index + 1)}. `))
        .join('\n');
}

export function formatCapturedRequest(
    request: CapturedRequest,
    firstLinePrefix = '  ',
): string {
    return [
        `${firstLinePrefix}${request.method} ${request.path}`,
        `     headers: ${formatCapturedHeaders(request.headers)}`,
        `     body: ${formatCapturedBody(request.body)}`,
    ].join('\n');
}

class CapturedRequestExpectationImpl implements CapturedRequestExpectation {
    constructor(private readonly request: CapturedRequest) {}

    public withHeader(name: string): HeaderExpectation {
        const header = this.request.headers[name.toLowerCase()];
        if (header === undefined) {
            throw new Error(
                [
                    `Expected request header ${name} to exist.`,
                    '',
                    'Captured request:',
                    formatCapturedRequest(this.request),
                ].join('\n'),
            );
        }

        return {
            matching: (pattern) => {
                if (!pattern.test(header)) {
                    throw new Error(
                        [
                            `Expected request header ${name} to match ${String(pattern)}, got ${JSON.stringify(header)}.`,
                            '',
                            'Captured request:',
                            formatCapturedRequest(this.request),
                        ].join('\n'),
                    );
                }
                return this;
            },
            toBe: (expected) => {
                if (header !== expected) {
                    throw new Error(
                        [
                            `Expected request header ${name} to be ${JSON.stringify(expected)}, got ${JSON.stringify(header)}.`,
                            '',
                            'Captured request:',
                            formatCapturedRequest(this.request),
                        ].join('\n'),
                    );
                }
                return this;
            },
        };
    }

    public withJsonPath(path: string): CapturedJsonPathExpectation {
        return {
            toBe: (expected) => {
                const value = readJsonPath(this.request.json, path);
                if (!Object.is(value, expected)) {
                    throw new Error(
                        [
                            `Expected captured request JSON path ${path} to be ${JSON.stringify(expected)}, got ${JSON.stringify(value)}.`,
                            '',
                            'Captured request:',
                            formatCapturedRequest(this.request),
                        ].join('\n'),
                    );
                }
                return this;
            },
            toExist: () => {
                const value = readJsonPath(this.request.json, path);
                if (value === undefined) {
                    throw new Error(
                        [
                            `Expected captured request JSON path ${path} to exist.`,
                            '',
                            'Captured request:',
                            formatCapturedRequest(this.request),
                        ].join('\n'),
                    );
                }
                return this;
            },
        };
    }
}

function formatCapturedHeaders(headers: Record<string, string>): string {
    const entries = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) {
        return '(none)';
    }

    return entries
        .slice(0, 12)
        .map(([name, value]) => `${name}: ${formatHeaderValue(name, value, 120)}`)
        .join('; ');
}

function formatCapturedBody(body: string): string {
    const value = body.trim();
    return value === '' ? '(empty)' : truncate(value, 500);
}
