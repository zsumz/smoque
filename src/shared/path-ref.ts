import type { PathRef } from '../types/path-ref.js';

export function toPathString(path: string | PathRef): string {
    return typeof path === 'string' ? path : path.toString();
}
