export interface PathRef {
    path(...parts: string[]): string;
    toString(): string;
}
