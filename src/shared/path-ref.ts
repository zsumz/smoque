import type { PathRef } from '../types.js';

export function toPathString(path: string | PathRef): string {
    return typeof path === 'string' ? path : path.toString();
}
