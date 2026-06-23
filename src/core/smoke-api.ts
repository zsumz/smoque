import { SmokeError } from '../errors.js';
import type { SmokePlugin } from '../plugin.js';
import type { SmokeContext, SuiteOptions } from '../types.js';
import { inferCallerFile } from './context/caller-file.js';

export type SuiteCallback = (t: SmokeContext) => Promise<void> | void;

export interface SmokeAuthoringApi {
    suite(name: string, fn: (t: SmokeContext) => Promise<void> | void): void;
    suite(name: string, options: SuiteOptions, fn: (t: SmokeContext) => Promise<void> | void): void;
    use(plugin: SmokePlugin): void;
}

export interface SmokeSuiteRegistry {
    addSuite(name: string, options: SuiteOptions, fn: SuiteCallback, file: string | undefined): void;
    use(plugin: SmokePlugin): void;
}

export function createSmokeApi(registry: SmokeSuiteRegistry): SmokeAuthoringApi {
    return {
        suite(name: string, optionsOrFn: SuiteOptions | SuiteCallback, maybeFn?: SuiteCallback): void {
            const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn;
            const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;

            if (!fn) {
                throw new SmokeError(`Smoke suite "${name}" is missing a callback.`);
            }

            registry.addSuite(name, options, fn, inferCallerFile());
        },
        use(plugin: SmokePlugin): void {
            registry.use(plugin);
        },
    };
}
