import { assertNetworkAllowed } from '../../network.js';
import type { SmokeContext } from '../../types/context.js';
import type { HttpRequestOptions, HttpResponse } from './client-types.js';
import { executeHttpRedirects } from './client-redirect.js';
import { parseHttpDuration } from './client-transport.js';
import { createHttpResponse } from './http-response.js';
import { parseOptionalJson } from './json.js';
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
    const headers = new Headers(options.headers ?? {});
    const body = requestBody(headers, options);
    const controller = new AbortController();
    const timeout = options.timeout
        ? setTimeout(() => {
            controller.abort();
        }, parseHttpDuration(options.timeout))
        : undefined;

    try {
        const response = await executeHttpRedirects({
            method,
            url,
            headers,
            body,
            options,
            signal: controller.signal,
            authorize: (nextMethod, nextUrl) => {
                assertNetworkAllowed(context, nextMethod, nextUrl);
            },
        });
        const text = response.body;
        const transcriptInput: TranscriptInputInit = {
            url,
            method,
            requestHeaders: Object.fromEntries(headers.entries()),
            status: response.status,
            headers: response.headers,
            body: text,
            json: parseOptionalJson(text),
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
