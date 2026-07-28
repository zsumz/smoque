import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from 'node:http';

import type { CapturedRequest } from './fake-request-expectations.js';
import {
    requestPath,
    routeKey,
    writeFakeResponse,
    type FakeRoute,
} from './fake-routes.js';
import { headersToRecord } from './headers.js';

export interface FakeServerTransport {
    server: Server;
    port: number;
}

export async function startFakeServer(
    routes: Map<string, FakeRoute>,
    captured: CapturedRequest[],
): Promise<FakeServerTransport> {
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

    return { server, port: address.port };
}

export async function closeFakeServer(server: Server): Promise<void> {
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

async function handleFakeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    routes: Map<string, FakeRoute>,
    captured: CapturedRequest[],
): Promise<void> {
    const method = request.method?.toUpperCase() ?? 'GET';
    const path = requestPath(request);
    const body = await readBody(request);
    captured.push({
        method,
        path,
        headers: headersToRecord(request.headers),
        body,
        json: parseJson(body),
    });

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
