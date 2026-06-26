import type { Probe, SmokeContext } from '../../types.js';
import type { HttpRequestOptions, HttpResponse } from './client.js';
import type { HttpTlsOptions } from './tls.js';

export interface HttpReadyOptions {
    method?: string;
    timeout?: string;
    headers?: Record<string, string>;
    status?: number | number[];
    tls?: HttpTlsOptions;
}

export type HttpRequestHandler = (
    context: SmokeContext,
    method: string,
    url: string,
    options?: HttpRequestOptions,
) => Promise<HttpResponse>;

export function createReadyProbe(
    context: SmokeContext,
    input: unknown,
    request: HttpRequestHandler,
): Probe {
    const [url, options] = normalizeReadyInput(input);
    const expectedStatuses = Array.isArray(options.status) ? options.status : [options.status ?? 200];
    const method = options.method ?? 'GET';

    return {
        description: `HTTP ${method} ${url} expected ${expectedStatuses.join(' or ')}`,
        async check() {
            try {
                const requestOptions: HttpRequestOptions = {
                    timeout: options.timeout ?? '2s',
                };
                if (options.headers) {
                    requestOptions.headers = options.headers;
                }
                if (options.tls) {
                    requestOptions.tls = options.tls;
                }

                const response = await request(context, method, url, requestOptions);
                return {
                    ready: expectedStatuses.includes(response.status),
                    message: `status ${String(response.status)}`,
                };
            } catch (error) {
                return {
                    ready: false,
                    message: error instanceof Error ? error.message : String(error),
                };
            }
        },
    };
}

function normalizeReadyInput(input: unknown): [string, HttpReadyOptions] {
    if (typeof input === 'string') {
        return [input, {}];
    }

    if (Array.isArray(input) && typeof input[0] === 'string') {
        return [input[0], (input[1] ?? {}) as HttpReadyOptions];
    }

    throw new Error('http.ready requires a URL string.');
}
