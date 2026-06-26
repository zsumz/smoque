import { SmokeError } from '../../errors.js';

export interface ComposePortOptions {
    protocol?: 'tcp' | 'udp';
}

export interface ComposePublishedPort {
    host: string;
    port: number;
    url(path?: string, protocol?: 'http' | 'https'): string;
}

export function parsePublishedPort(
    output: string,
    service: string,
    containerPort: number,
): ComposePublishedPort {
    const line = output.split(/\r?\n/u).map((entry) => entry.trim()).find(Boolean);
    if (!line) {
        throw new SmokeError(`Docker Compose did not report a published port for ${service}:${String(containerPort)}.`, {
            service,
            containerPort,
            output,
        });
    }

    const parsed = /^(?:\[?(?<host>[^\]]+)\]?:|(?<plainHost>[^:]+):)(?<port>\d+)$/u.exec(line);
    const port = Number.parseInt(parsed?.groups?.port ?? '', 10);
    if (!parsed || !Number.isInteger(port)) {
        throw new SmokeError(`Could not parse Docker Compose published port: ${line}`, {
            service,
            containerPort,
            output,
        });
    }

    const host = parsed.groups?.host ?? parsed.groups?.plainHost ?? '127.0.0.1';
    return {
        host: host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host,
        port,
        url(path = '/', protocol: 'http' | 'https' = 'http'): string {
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
            const hostForUrl = this.host.includes(':') ? `[${this.host}]` : this.host;
            return `${protocol}://${hostForUrl}:${String(this.port)}${normalizedPath}`;
        },
    };
}
