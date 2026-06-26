import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { readJsonPath } from '../../json-path.js';
import { assertNetworkAllowed } from '../../network.js';
import type { ArtifactSink, SmokeContext, SmokeResource } from '../../types.js';
import { headersToRecord } from './headers.js';
import { classifyHttpRequestError, normalizeTlsOptions, type HttpTlsOptions } from './tls.js';
import {
    createTranscriptInput,
    formatHttpTranscript,
    transcriptName,
    type HttpResponseInput,
    type TranscriptInputInit,
} from './transcript.js';

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

export async function request(
    context: SmokeContext,
    method: string,
    url: string,
    options: HttpRequestOptions = {},
): Promise<HttpResponse> {
    assertNetworkAllowed(context, method, url);

    const headers = new Headers(options.headers ?? {});
    let body: string | Uint8Array | undefined;

    if (options.json !== undefined) {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
        }
        body = JSON.stringify(options.json);
    } else if (options.body !== undefined) {
        body = options.body;
    }

    const controller = new AbortController();
    const timeout = options.timeout
        ? setTimeout(() => {
            controller.abort();
        }, parseDuration(options.timeout))
        : undefined;

    try {
        const init: RequestInit = {
            method,
            headers,
            signal: controller.signal,
        };
        if (body !== undefined) {
            init.body = typeof body === 'string' ? body : new Blob([toArrayBuffer(body)]);
        }

        const response =
            options.tls === undefined
                ? await fetchHttpRequest(url, init)
                : await nodeHttpRequest(method, url, Object.fromEntries(headers.entries()), body, options);
        const text = response.body;
        const parsedJson = parseJson(text);
        const transcriptInput: TranscriptInputInit = {
            url,
            method,
            requestHeaders: Object.fromEntries(headers.entries()),
            status: response.status,
            headers: response.headers,
            body: text,
            json: parsedJson,
        };
        if (typeof body === 'string') {
            transcriptInput.requestBody = body;
        }

        return createHttpResponse(createTranscriptInput(transcriptInput));
    } catch (error) {
        const transcriptInput: TranscriptInputInit = {
            url,
            method,
            requestHeaders: Object.fromEntries(headers.entries()),
            error: error instanceof Error ? error.message : String(error),
        };
        if (typeof body === 'string') {
            transcriptInput.requestBody = body;
        }

        await context.attach.text(
            transcriptName(method, url),
            formatHttpTranscript(createTranscriptInput(transcriptInput)),
        );
        throw classifyHttpRequestError(method, url, error);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

interface NormalizedHttpResponse {
    status: number;
    headers: Record<string, string>;
    body: string;
}

async function fetchHttpRequest(url: string, init: RequestInit): Promise<NormalizedHttpResponse> {
    const response = await fetch(url, init);
    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
    };
}

async function nodeHttpRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: string | Uint8Array | undefined,
    options: HttpRequestOptions,
): Promise<NormalizedHttpResponse> {
    const parsed = new URL(url);
    const tls = await normalizeTlsOptions(parsed, options.tls);
    const requestOptions = {
        method,
        headers,
        rejectUnauthorized: tls.rejectUnauthorized,
        ca: tls.ca,
    };
    const client = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

    return await new Promise<NormalizedHttpResponse>((resolve, reject) => {
        const request = client(parsed, requestOptions, (response) => {
            const chunks: Uint8Array[] = [];
            response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
            response.on('error', reject);
            response.on('end', () => {
                resolve({
                    status: response.statusCode ?? 0,
                    headers: headersToRecord(response.headers),
                    body: Buffer.concat(chunks).toString('utf8'),
                });
            });
        });

        request.on('error', reject);
        if (options.timeout !== undefined) {
            request.setTimeout(parseDuration(options.timeout), () => {
                request.destroy(new Error(`HTTP request timed out after ${String(options.timeout)}.`));
            });
        }
        if (body !== undefined) {
            request.write(body);
        }
        request.end();
    });
}

function createHttpResponse(input: HttpResponseInput): HttpResponse {
    return new HttpResponseResource(input);
}

class HttpResponseResource implements HttpResponse, SmokeResource {
    public readonly name: string;
    public readonly kind = 'http.response';
    public readonly url: string;
    public readonly method: string;
    public readonly status: number;
    public readonly headers: Record<string, string>;
    public readonly body: string;
    public readonly json: unknown;
    private attachTranscript = false;

    constructor(private readonly input: HttpResponseInput) {
        this.name = transcriptName(input.method, input.url);
        this.url = input.url;
        this.method = input.method;
        this.status = input.status;
        this.headers = input.headers;
        this.body = input.body;
        this.json = input.json;
    }

    public expectStatus(status: number): HttpResponse {
        if (this.status !== status) {
            this.attachTranscript = true;
            throw new Error(
                `Expected HTTP ${this.method} ${this.url} to return ${String(status)}, got ${String(this.status)}.`,
            );
        }
        return this;
    }

    public expectHeader(name: string): ResponseHeaderExpectation {
        const normalizedName = name.toLowerCase();
        const header = this.headers[normalizedName];

        return {
            matching: (pattern): HttpResponse => {
                if (header === undefined) {
                    this.attachTranscript = true;
                    throw new Error(`Expected response header ${name} to exist.`);
                }
                if (!pattern.test(header)) {
                    this.attachTranscript = true;
                    throw new Error(
                        `Expected response header ${name} to match ${String(pattern)}, got ${JSON.stringify(header)}.`,
                    );
                }
                return this;
            },
            toBe: (expected): HttpResponse => {
                if (header === undefined) {
                    this.attachTranscript = true;
                    throw new Error(`Expected response header ${name} to exist.`);
                }
                if (header !== expected) {
                    this.attachTranscript = true;
                    throw new Error(
                        `Expected response header ${name} to be ${JSON.stringify(expected)}, got ${JSON.stringify(header)}.`,
                    );
                }
                return this;
            },
            toExist: (): HttpResponse => {
                if (header === undefined) {
                    this.attachTranscript = true;
                    throw new Error(`Expected response header ${name} to exist.`);
                }
                return this;
            },
        };
    }

    public expectJsonPath(path: string): JsonPathExpectation {
        return {
            toBe: (expected): HttpResponse => {
                const value = readJsonPath(this.json, path);
                if (!Object.is(value, expected)) {
                    this.attachTranscript = true;
                    throw new Error(
                        `Expected JSON path ${path} to be ${JSON.stringify(expected)}, got ${JSON.stringify(value)}.`,
                    );
                }
                return this;
            },
            toExist: (): HttpResponse => {
                const value = readJsonPath(this.json, path);
                if (value === undefined) {
                    this.attachTranscript = true;
                    throw new Error(`Expected JSON path ${path} to exist.`);
                }
                return this;
            },
        };
    }

    public async cleanup(): Promise<void> {
        return Promise.resolve();
    }

    public async attachOnFailure(attach: ArtifactSink): Promise<void> {
        if (!this.attachTranscript) {
            return;
        }

        await attach.text(this.name, formatHttpTranscript(this.input));
    }
}

function parseJson(text: string): unknown {
    if (text.trim() === '') {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function parseDuration(value: string): number {
    const match = /^(\d+)(ms|s|m)$/.exec(value);
    if (!match) {
        throw new Error(`Invalid HTTP timeout: ${value}`);
    }

    const amount = Number.parseInt(match[1] ?? '0', 10);
    const unit = match[2];

    if (unit === 'ms') {
        return amount;
    }
    if (unit === 's') {
        return amount * 1000;
    }
    return amount * 60_000;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.buffer;
}
