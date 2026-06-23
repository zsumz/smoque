export interface PortsApi {
    reserve(name?: string, options?: PortReserveOptions): Promise<ReservedPort>;
    env(values: Record<string, PortEnvValue>): Record<string, string | undefined>;
}

export interface PortReserveOptions {
    host?: string;
}

export interface ReservedPort {
    readonly name: string;
    readonly host: string;
    readonly port: number;
    url(path?: string, protocol?: 'http' | 'https'): string;
    toString(): string;
}

export type PortEnvValue = string | number | boolean | ReservedPort | undefined | null;
