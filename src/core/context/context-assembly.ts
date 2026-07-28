import { SmokeError } from '../../errors.js';
import type { SmokeContext } from '../../types/context.js';

type StandardPluginContextKey =
    | 'archive'
    | 'compose'
    | 'http'
    | 'npm'
    | 'postgres';

type CoreSmokeContext = Omit<SmokeContext, StandardPluginContextKey>;

export type SmokeContextAssembly = Omit<CoreSmokeContext, 'fixture' | 'net'> & {
    fixture: CoreSmokeContext['fixture'] | undefined;
    net: CoreSmokeContext['net'] | undefined;
};

export function deferredContextValue<T>(value: T | undefined): T | undefined {
    return value;
}

export function assertContextAssemblyComplete(
    context: SmokeContextAssembly,
): asserts context is CoreSmokeContext {
    const missing = [
        context.fixture === undefined ? 'fixture' : undefined,
        context.net === undefined ? 'net' : undefined,
    ].filter((name): name is string => name !== undefined);

    if (missing.length > 0) {
        throw new SmokeError('Smoke context assembly is incomplete.', { missing });
    }
}
