import { assertNetworkAllowed } from '../../network.js';
import type { SmokeContext } from '../../types/context.js';
import type { HttpRequestOptions, HttpResponse } from './client-types.js';
import { executeHttpRequest, parseHttpDuration } from './client-transport.js';
import { createHttpResponse } from './http-response.js';
import { classifyHttpRequestError } from './tls.js';
import {
    createTranscriptInput,
    formatHttpTranscript,
    transcriptName,
    type TranscriptInputInit,
} from './transcript.js';

export type {
    HttpRequestOptions,
    HttpResponse,
    JsonPathExpectation,
    ResponseHeaderExpectation,
} from './client-types.js';

export async function request(
    context: SmokeContext,
    method: string,
    url: string,
    options: HttpRequestOptions = {},
): Promise<HttpResponse> {
    assertNetworkAllowed(context, method, url);

    const headers = new Headers(options.headers ?? {});
    const body = requestBody(headers, options);
    const controller = new AbortController();
    const timeout = options.timeout
        ? setTimeout(() => {
            controller.abort();
        }, parseHttpDuration(options.timeout))
        : undefined;

    try {
        const response = await executeHttpRequest(
            method,
            url,
            headers,
            body,
            options,
            controller.signal,
        );
        const text = response.body;
        const transcriptInput: TranscriptInputInit = {
            url,
            method,
            requestHeaders: Object.fromEntries(headers.entries()),
            status: response.status,
            headers: response.headers,
            body: text,
            json: parseJson(text),
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

function requestBody(
    headers: Headers,
    options: HttpRequestOptions,
): string | Uint8Array | undefined {
    if (options.json !== undefined) {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
        }
        return JSON.stringify(options.json);
    }
    return options.body;
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
