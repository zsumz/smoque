import { definePlugin } from '../plugin.js';
import type { SmokePlugin } from '../plugin.js';
import type { Probe } from '../types.js';
import {
    request,
    type HttpRequestOptions,
    type HttpResponse,
} from './http/client.js';
import { createFakeServer, type FakeHttpServer } from './http/fake-server.js';
import { createReadyProbe, type HttpReadyOptions } from './http/ready-probe.js';

export type {
    HttpRequestOptions,
    HttpResponse,
    JsonPathExpectation,
    ResponseHeaderExpectation,
} from './http/client.js';
export type {
    CapturedJsonPathExpectation,
    CapturedRequest,
    CapturedRequestExpectation,
    HeaderExpectation,
} from './http/fake-request-expectations.js';
export type { FakeHttpServer } from './http/fake-server.js';
export type { FakeRouteBuilder } from './http/fake-routes.js';
export type { HttpReadyOptions } from './http/ready-probe.js';
export type { HttpTlsOptions } from './http/tls.js';

export interface HttpApi {
    request(method: string, url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
    get(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
    post(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
    put(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
    patch(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
    delete(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
    ready(url: string, options?: HttpReadyOptions): Probe;
    fakeServer(name?: string): Promise<FakeHttpServer>;
}

declare module '../types.js' {
    interface SmokeContext {
        http: HttpApi;
    }
}

export default function httpPlugin(): SmokePlugin {
    return definePlugin({
        name: 'smoque:http',
        version: '0.0.0',
        register(registry) {
            registry.action('http.request', async (t, method, url, options) =>
                request(
                    t,
                    String(method),
                    String(url),
                    options as HttpRequestOptions | undefined,
                ),
            );
            registry.action('http.get', async (t, url, options) =>
                request(t, 'GET', String(url), options as HttpRequestOptions | undefined),
            );
            registry.action('http.post', async (t, url, options) =>
                request(t, 'POST', String(url), options as HttpRequestOptions | undefined),
            );
            registry.action('http.put', async (t, url, options) =>
                request(t, 'PUT', String(url), options as HttpRequestOptions | undefined),
            );
            registry.action('http.patch', async (t, url, options) =>
                request(t, 'PATCH', String(url), options as HttpRequestOptions | undefined),
            );
            registry.action('http.delete', async (t, url, options) =>
                request(t, 'DELETE', String(url), options as HttpRequestOptions | undefined),
            );
            registry.resource('http.fakeServer', async (_t, options) => {
                return createFakeServer(typeof options === 'string' ? options : undefined);
            });
            registry.probe(
                'http.ready',
                (t, options) => createReadyProbe(t, options, request),
            );
        },
    });
}
