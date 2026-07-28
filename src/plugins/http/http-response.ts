import { readJsonPath } from '../../json-path.js';
import type { ArtifactSink, SmokeResource } from '../../types/artifacts.js';
import type {
    HttpResponse,
    JsonPathExpectation,
    ResponseHeaderExpectation,
} from './client-types.js';
import {
    formatHttpTranscript,
    transcriptName,
    type HttpResponseInput,
} from './transcript.js';

export function createHttpResponse(input: HttpResponseInput): HttpResponse {
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
