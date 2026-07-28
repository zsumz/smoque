import type { Server } from 'node:http';

import type { ArtifactSink } from '../../types.js';
import {
    createCapturedRequestExpectation,
    formatCapturedRequests,
    type CapturedRequest,
    type CapturedRequestExpectation,
} from './fake-request-expectations.js';
import {
    closeFakeServer,
    startFakeServer,
} from './fake-server-transport.js';
import {
    createFakeRouteBuilder,
    normalizePath,
    type FakeRoute,
    type FakeRouteBuilder,
} from './fake-routes.js';

export interface FakeHttpServer {
    readonly name: string;
    readonly kind: 'http.fakeServer';
    url(path?: string): string;
    get(path: string): FakeRouteBuilder;
    post(path: string): FakeRouteBuilder;
    put(path: string): FakeRouteBuilder;
    patch(path: string): FakeRouteBuilder;
    delete(path: string): FakeRouteBuilder;
    requests(): CapturedRequest[];
    expectRequest(method: string, path: string): CapturedRequestExpectation;
    cleanup(): Promise<void>;
}

export async function createFakeServer(name = 'fake-http'): Promise<FakeHttpServer> {
    const routes: Map<string, FakeRoute> = new Map();
    const captured: CapturedRequest[] = [];
    const transport = await startFakeServer(routes, captured);
    return new FakeHttpServerResource(
        name,
        transport.server,
        transport.port,
        routes,
        captured,
    );
}

class FakeHttpServerResource implements FakeHttpServer {
    public readonly kind = 'http.fakeServer' as const;
    private closed = false;
    private attachRequests = false;

    constructor(
        public readonly name: string,
        private readonly server: Server,
        private readonly port: number,
        private readonly routes: Map<string, FakeRoute>,
        private readonly captured: CapturedRequest[],
    ) {}

    public url(path = '/'): string {
        return `http://127.0.0.1:${String(this.port)}${path.startsWith('/') ? path : `/${path}`}`;
    }

    public get(path: string): FakeRouteBuilder {
        return this.route('GET', path);
    }

    public post(path: string): FakeRouteBuilder {
        return this.route('POST', path);
    }

    public put(path: string): FakeRouteBuilder {
        return this.route('PUT', path);
    }

    public patch(path: string): FakeRouteBuilder {
        return this.route('PATCH', path);
    }

    public delete(path: string): FakeRouteBuilder {
        return this.route('DELETE', path);
    }

    public requests(): CapturedRequest[] {
        return this.captured.map((request) => ({ ...request, headers: { ...request.headers } }));
    }

    public expectRequest(method: string, path: string): CapturedRequestExpectation {
        const expectedPath = normalizePath(path);
        const request = this.captured.find(
            (capturedRequest) =>
                capturedRequest.method === method.toUpperCase() && capturedRequest.path === expectedPath,
        );

        if (!request) {
            this.attachRequests = true;
            throw new Error(
                [
                    `Expected captured request ${method.toUpperCase()} ${expectedPath}, but none was received.`,
                    '',
                    'Received requests:',
                    formatCapturedRequests(this.captured),
                ].join('\n'),
            );
        }

        return createCapturedRequestExpectation(request);
    }

    public async attachOnFailure(attach: ArtifactSink): Promise<void> {
        if (!this.attachRequests) {
            return;
        }

        await attach.text(`${this.name}-requests.txt`, formatCapturedRequests(this.captured));
    }

    public async cleanup(): Promise<void> {
        if (this.closed) {
            return;
        }

        this.closed = true;
        await closeFakeServer(this.server);
    }

    private route(method: string, path: string): FakeRouteBuilder {
        return createFakeRouteBuilder(this.routes, method, path);
    }
}
