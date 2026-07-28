import assert from 'node:assert/strict';

export interface DetailedExpectationError extends Error {
    details: Record<string, unknown>;
}

export function assertDetailedExpectationError(
    error: unknown,
): asserts error is DetailedExpectationError {
    assert.ok(error instanceof Error);
    assert.ok('details' in error);
    assert.ok(typeof error.details === 'object' && error.details !== null);
}
