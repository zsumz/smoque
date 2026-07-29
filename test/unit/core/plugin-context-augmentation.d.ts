import type { Probe } from '../../../dist/core.js';

declare module '../../../dist/types/context.js' {
    interface SmokeContext {
        readonly example: {
            client(): Promise<unknown>;
            data(): Promise<unknown>;
            echo(value: unknown): Promise<unknown>;
            ready(message: unknown): Probe;
            useClient(): Promise<unknown>;
        };
    }
}
