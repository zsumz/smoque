import { SmokeError } from '../../errors.js';
import type { HttpReadyOptions } from '../http.js';
import type { ComposePortOptions, ComposePublishedPort } from './ports.js';
import type { Probe, SmokeContext } from '../../types.js';

export interface ComposeService {
    readonly name: string;
    port(containerPort: number, options?: ComposePortOptions): Promise<ComposePublishedPort>;
    url(containerPort: number, path?: string, protocol?: 'http' | 'https'): Promise<string>;
    ready(containerPort: number, options?: ComposeServiceReadyOptions): Probe;
}

export interface ComposeServiceReadyOptions extends HttpReadyOptions {
    path?: string;
    protocol?: 'http' | 'https';
}

export interface ComposePortResolver {
    port(
        service: string,
        containerPort: number,
        options?: ComposePortOptions,
    ): Promise<ComposePublishedPort>;
}

export class ManagedComposeService implements ComposeService {
    constructor(
        private readonly t: SmokeContext,
        private readonly project: ComposePortResolver,
        public readonly name: string,
    ) {}

    public async port(containerPort: number, options: ComposePortOptions = {}): Promise<ComposePublishedPort> {
        return await this.project.port(this.name, containerPort, options);
    }

    public async url(containerPort: number, path = '/', protocol: 'http' | 'https' = 'http'): Promise<string> {
        const published = await this.port(containerPort);
        return published.url(path, protocol);
    }

    public ready(containerPort: number, options: ComposeServiceReadyOptions = {}): Probe {
        const { path = '/', protocol = 'http', ...httpOptions } = options;

        return {
            description: `docker compose service ${this.name}:${String(containerPort)} HTTP ready`,
            check: async () => {
                const url = await this.url(containerPort, path, protocol);
                const http = this.t.http as typeof this.t.http | undefined;
                if (!http) {
                    throw new SmokeError('Compose service HTTP readiness requires the smoque HTTP plugin.', {
                        service: this.name,
                        containerPort,
                    });
                }
                return await http.ready(url, httpOptions).check();
            },
        };
    }
}
