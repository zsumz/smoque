import { join, resolve } from 'node:path';

import type { PathRef } from './types.js';

export class BasicPathRef implements PathRef {
    private readonly value: string;

    constructor(path: string) {
        this.value = resolve(path);
    }

    public path(...parts: string[]): string {
        return join(this.value, ...parts);
    }

    public toString(): string {
        return this.value;
    }
}

export function toPathRef(path: string | PathRef, base?: string | PathRef): PathRef {
    if (typeof path !== 'string') {
        return path;
    }

    if (base) {
        return new BasicPathRef(resolve(pathToString(base), path));
    }

    return new BasicPathRef(path);
}

export function pathToString(path: string | PathRef): string {
    return typeof path === 'string' ? resolve(path) : path.toString();
}

export function resolveContextPath(repoRoot: string | PathRef, path: string | PathRef): string {
    return typeof path === 'string' ? resolve(pathToString(repoRoot), path) : path.toString();
}
