import { SmokeError } from '../../errors.js';
import type { HttpRequestOptions } from './client-types.js';
import {
    executeHttpRequest,
    type NormalizedHttpResponse,
} from './client-transport.js';

const redirectLimit = 20;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const bodyHeaderNames = [
    'content-encoding',
    'content-language',
    'content-length',
    'content-location',
    'content-type',
];
const crossOriginSensitiveHeaders = [
    'authorization',
    'cookie',
    'cookie2',
    'proxy-authorization',
    'www-authenticate',
];

interface HttpRequestState {
    method: string;
    url: string;
    headers: Headers;
    body: string | Uint8Array | undefined;
}

interface HttpRedirectInput extends HttpRequestState {
    options: HttpRequestOptions;
    signal: AbortSignal;
    authorize(method: string, url: string): void;
}

export async function executeHttpRedirects(
    input: HttpRedirectInput,
): Promise<NormalizedHttpResponse> {
    let request: HttpRequestState = input;
    let redirectCount = 0;

    for (;;) {
        input.authorize(request.method, request.url);
        const response = await executeHttpRequest(
            request.method,
            request.url,
            request.headers,
            request.body,
            input.options,
            input.signal,
        );
        const next = redirectRequest(request, response);
        if (next === undefined) {
            return response;
        }
        if (redirectCount >= redirectLimit) {
            throw redirectLimitError(request, redirectCount);
        }
        request = next;
        redirectCount += 1;
    }
}

export function redirectRequest(
    request: HttpRequestState,
    response: Pick<NormalizedHttpResponse, 'status' | 'headers'>,
): HttpRequestState | undefined {
    const location = response.headers.location;
    if (!redirectStatuses.has(response.status) || location === undefined) {
        return undefined;
    }

    const url = resolveRedirectUrl(request.url, location);
    const headers = new Headers(request.headers);
    const method = redirectedMethod(request.method, response.status);
    const dropsBody = method !== request.method;
    const body = dropsBody ? undefined : request.body;

    if (dropsBody) {
        for (const name of bodyHeaderNames) {
            headers.delete(name);
        }
    }
    if (new URL(request.url).origin !== new URL(url).origin) {
        for (const name of crossOriginSensitiveHeaders) {
            headers.delete(name);
        }
    }
    headers.delete('host');
    return { method, url, headers, body };
}

function redirectedMethod(method: string, status: number): string {
    const normalized = method.toUpperCase();
    if ((status === 301 || status === 302) && normalized === 'POST') {
        return 'GET';
    }
    if (status === 303 && normalized !== 'GET' && normalized !== 'HEAD') {
        return 'GET';
    }
    return method;
}

function resolveRedirectUrl(currentUrl: string, location: string): string {
    const current = new URL(currentUrl);
    const resolved = new URL(location, currentUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        throw new SmokeError(`Unsupported HTTP redirect protocol: ${resolved.protocol}`, {
            url: resolved.toString(),
            protocol: resolved.protocol,
        });
    }
    if (current.protocol === 'https:' && resolved.protocol === 'http:') {
        throw new SmokeError('Refusing HTTP redirect from https:// to http://.', {
            sourceUrl: current.toString(),
            destinationUrl: resolved.toString(),
        });
    }
    return resolved.toString();
}

function redirectLimitError(
    request: HttpRequestState,
    redirectCount: number,
): SmokeError {
    return new SmokeError(`HTTP redirect limit exceeded after ${String(redirectCount)} redirects.`, {
        method: request.method.toUpperCase(),
        url: request.url,
        redirectLimit,
    });
}
