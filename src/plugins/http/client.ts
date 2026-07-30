import { assertNetworkAllowed } from '../../network.js';
import type { SmokeContext } from '../../types/context.js';
import type { HttpRequestOptions, HttpResponse } from './client-types.js';
import { executeHttpRedirects } from './client-redirect.js';
import {
    createHttpTimeoutSignal,
    preserveHttpTimeoutError,
} from './client-timeout.js';
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
    const signal = createHttpTimeoutSignal(options.timeout);

    try {
        const response = await executeHttpRedirects({
            method,
            url,
            headers,
            body,
            options,
            signal,
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
        const requestError = preserveHttpTimeoutError(error, signal);
        const transcriptInput: TranscriptInputInit = {
            url,
            method,
            requestHeaders: Object.fromEntries(headers.entries()),
            error: requestError instanceof Error ? requestError.message : String(requestError),
        };
        if (typeof body === 'string') {
            transcriptInput.requestBody = body;
        }

        await context.attach.text(
            transcriptName(method, url),
            formatHttpTranscript(createTranscriptInput(transcriptInput)),
        );
        throw classifyHttpRequestError(method, url, requestError);
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
