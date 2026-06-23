export interface ToolDiscovery {
    node(options?: ToolVersionOptions): Promise<ToolRef>;
    npm(options?: ToolVersionOptions): Promise<ToolRef>;
    java(options?: ToolVersionOptions): Promise<ToolRef>;
    jar(options?: ToolVersionOptions): Promise<ToolRef>;
    docker(options?: ToolVersionOptions): Promise<ToolRef>;
}

export interface ToolVersionOptions {
    minVersion?: string | number;
    required?: boolean;
}

export interface ToolRef {
    command: string;
    version?: string;
    path?: string;
}
