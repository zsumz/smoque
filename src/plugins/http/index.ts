import { definePlugin } from '../../plugin.js';
import type { SmokePlugin } from '../../plugin.js';
import type { Probe } from '../../types.js';
import {
    request,
    type HttpRequestOptions,
    type HttpResponse,
} from './client.js';
import { createFakeServer, type FakeHttpServer } from './fake-server.js';
import { createReadyProbe, type HttpReadyOptions } from './ready-probe.js';

export type {
    HttpRequestOptions,
    HttpResponse,
    JsonPathExpectation,
    ResponseHeaderExpectation,
} from './client.js';
export type {
    CapturedJsonPathExpectation,
    CapturedRequest,
    CapturedRequestExpectation,
    HeaderExpectation,
} from './fake-request-expectations.js';
export type { FakeHttpServer } from './fake-server.js';
export type { FakeRouteBuilder } from './fake-routes.js';
export type { HttpReadyOptions } from './ready-probe.js';
export type { HttpTlsOptions } from './tls.js';

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

declare module '../../types.js' {
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
                request(t, String(method), String(url), options as HttpRequestOptions | undefined),
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
            registry.resource('http.fakeServer', async (t, options) => {
                const server = await createFakeServer(typeof options === 'string' ? options : undefined);
                return server;
            });
            registry.probe('http.ready', (t, options) => createReadyProbe(t, options, request));
        },
    });
}
