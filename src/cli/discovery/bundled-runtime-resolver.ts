import { registerHooks } from 'node:module';

let registered = false;

export function registerBundledRuntimeResolver(): void {
    if (registered) {
        return;
    }

    const runtimeUrls = new Map([
        ['smoque', new URL('../../index.js', import.meta.url).href],
        ['smoque/plugin', new URL('../../plugin.js', import.meta.url).href],
    ]);
    registerHooks({
        resolve(specifier, context, nextResolve) {
            const runtimeUrl = runtimeUrls.get(specifier);
            if (runtimeUrl !== undefined) {
                return { url: runtimeUrl, shortCircuit: true };
            }

            const result = nextResolve(specifier, context);
            if (result.url.endsWith('.smoke.ts')) {
                return { ...result, format: 'module-typescript' };
            }
            return result;
        },
    });
    registered = true;
}
