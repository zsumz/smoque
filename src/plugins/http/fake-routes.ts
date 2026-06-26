import type { IncomingMessage, ServerResponse } from 'node:http';

export interface FakeRouteBuilder {
    reply(status: number, body?: unknown, headers?: Record<string, string>): void;
}

export interface FakeRoute {
    status: number;
    body: unknown;
    headers: Record<string, string>;
}

export function createFakeRouteBuilder(
    routes: Map<string, FakeRoute>,
    method: string,
    path: string,
): FakeRouteBuilder {
    return {
        reply: (status, body, headers = {}) => {
            routes.set(routeKey(method, path), { status, body, headers });
        },
    };
}

export function writeFakeResponse(response: ServerResponse, route: FakeRoute): void {
    response.statusCode = route.status;
    for (const [name, value] of Object.entries(route.headers)) {
        response.setHeader(name, value);
    }

    if (route.body === undefined) {
        response.end();
        return;
    }

    if (typeof route.body === 'string') {
        if (!response.hasHeader('content-type')) {
            response.setHeader('content-type', 'text/plain; charset=utf-8');
        }
        response.end(route.body);
        return;
    }

    if (route.body instanceof Uint8Array) {
        response.end(route.body);
        return;
    }

    if (!response.hasHeader('content-type')) {
        response.setHeader('content-type', 'application/json; charset=utf-8');
    }
    response.end(JSON.stringify(route.body));
}

export function routeKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${normalizePath(path)}`;
}

export function normalizePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}

export function requestPath(request: IncomingMessage): string {
    return new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
}
