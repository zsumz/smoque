import { performance } from 'node:perf_hooks';

export function monotonicMilliseconds(): number {
    return performance.now();
}

export function elapsedMilliseconds(startedAt: number): number {
    return Math.max(0, Math.round(monotonicMilliseconds() - startedAt));
}
