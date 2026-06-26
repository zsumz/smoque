import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from 'node:http';

import type { ArtifactSink } from '../../types.js';
import {
    createCapturedRequestExpectation,
    formatCapturedRequests,
    type CapturedRequest,
    type CapturedRequestExpectation,
} from './fake-request-expectations.js';
import {
    createFakeRouteBuilder,
    normalizePath,
    requestPath,
    routeKey,
    writeFakeResponse,
    type FakeRoute,
    type FakeRouteBuilder,
} from './fake-routes.js';
import { headersToRecord } from './headers.js';

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
    const server = createServer((request, response) => {
        void handleFakeRequest(request, response, routes, captured).catch((error: unknown) => {
            response.statusCode = 500;
            response.setHeader('content-type', 'text/plain; charset=utf-8');
            response.end(error instanceof Error ? error.message : String(error));
        });
    });

    await listen(server);
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
        throw new Error('Fake HTTP server did not bind to a TCP port.');
    }

    return new FakeHttpServerResource(name, server, address.port, routes, captured);
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
        await close(this.server);
    }

    private route(method: string, path: string): FakeRouteBuilder {
        return createFakeRouteBuilder(this.routes, method, path);
    }
}

async function handleFakeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    routes: Map<string, FakeRoute>,
    captured: CapturedRequest[],
): Promise<void> {
    const method = request.method?.toUpperCase() ?? 'GET';
    const path = requestPath(request);
    const body = await readBody(request);
    const capturedRequest: CapturedRequest = {
        method,
        path,
        headers: headersToRecord(request.headers),
        body,
        json: parseJson(body),
    };

    captured.push(capturedRequest);

    const route = routes.get(routeKey(method, path));
    if (!route) {
        response.statusCode = 404;
        response.setHeader('content-type', 'text/plain; charset=utf-8');
        response.end(`No fake HTTP route for ${method} ${path}`);
        return;
    }

    writeFakeResponse(response, route);
}

async function listen(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
}

async function close(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        request.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        request.on('error', reject);
        request.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
    });
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
