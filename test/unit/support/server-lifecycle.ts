import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:net';

import {
    closeServer,
    listenOnEphemeralPort,
} from '../../../dist/shared/server.js';

export {
    closeServer as close,
    listenOnEphemeralPort as listen,
};

export function serverPort(server: Server): number {
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    return address.port;
}

export async function reserveFreePort(): Promise<number> {
    const server = createServer();
    await listenOnEphemeralPort(server);
    const port = serverPort(server);
    await closeServer(server);
    return port;
}
