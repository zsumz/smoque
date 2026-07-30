import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { text as readText } from 'node:stream/consumers';

import type { HttpRequestOptions } from './client-types.js';
import { headersToRecord } from './headers.js';
import { normalizeTlsOptions } from './tls.js';

export interface NormalizedHttpResponse {
    status: number;
    headers: Record<string, string>;
    body: string;
}

export async function executeHttpRequest(
    method: string,
    url: string,
    headers: Headers,
    body: string | Uint8Array | undefined,
    options: HttpRequestOptions,
    signal: AbortSignal,
): Promise<NormalizedHttpResponse> {
    if (options.tls !== undefined) {
        return nodeHttpRequest(
            method,
            url,
            Object.fromEntries(headers.entries()),
            body,
            options,
            signal,
        );
    }

    const init: RequestInit = {
        method,
        headers,
        signal,
        redirect: 'manual',
    };
    if (body !== undefined) {
        init.body = typeof body === 'string' ? body : new Blob([toArrayBuffer(body)]);
    }
    return fetchHttpRequest(url, init);
}

export function parseHttpDuration(value: string): number {
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

async function fetchHttpRequest(
    url: string,
    init: RequestInit,
): Promise<NormalizedHttpResponse> {
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
    signal: AbortSignal,
): Promise<NormalizedHttpResponse> {
    const parsed = new URL(url);
    const tls = await normalizeTlsOptions(parsed, options.tls);
    const requestOptions = {
        method,
        headers,
        rejectUnauthorized: tls.rejectUnauthorized,
        ca: tls.ca,
        signal,
    };
    const client = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

    return await new Promise<NormalizedHttpResponse>((resolve, reject) => {
        const request = client(parsed, requestOptions, (response) => {
            void normalizeNodeResponse(response).then(resolve, reject);
        });

        request.on('error', reject);
        if (options.timeout !== undefined) {
            request.setTimeout(parseHttpDuration(options.timeout), () => {
                request.destroy(
                    new Error(`HTTP request timed out after ${String(options.timeout)}.`),
                );
            });
        }
        if (body !== undefined) {
            request.write(body);
        }
        request.end();
    });
}

async function normalizeNodeResponse(response: IncomingMessage): Promise<NormalizedHttpResponse> {
    return {
        status: response.statusCode ?? 0,
        headers: headersToRecord(response.headers),
        body: await readText(response),
    };
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.buffer;
}
