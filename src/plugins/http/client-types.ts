import type { HttpTlsOptions } from './tls.js';

export interface HttpRequestOptions {
    headers?: Record<string, string>;
    json?: unknown;
    body?: string | Uint8Array;
    timeout?: string;
    tls?: HttpTlsOptions;
}

export interface HttpResponse {
    url: string;
    method: string;
    status: number;
    headers: Record<string, string>;
    body: string;
    json: unknown;
    expectStatus(status: number): HttpResponse;
    expectHeader(name: string): ResponseHeaderExpectation;
    expectJsonPath(path: string): JsonPathExpectation;
}

export interface ResponseHeaderExpectation {
    matching(pattern: RegExp): HttpResponse;
    toBe(expected: string): HttpResponse;
    toExist(): HttpResponse;
}

export interface JsonPathExpectation {
    toBe(expected: unknown): HttpResponse;
    toExist(): HttpResponse;
}
