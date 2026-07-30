import type { IncomingMessage } from 'node:http';

export {
    close,
    listen,
    reserveFreePort,
    serverPort,
} from '../../support/server-lifecycle.js';

export async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks).toString('utf8');
}
