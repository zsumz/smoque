import { SmokeError } from '../../errors.js';
import type { SmokeResource } from '../../types/artifacts.js';
import type { SmokeContext } from '../../types/context.js';
import type { SmokeContextHost } from './smoke-context.js';

export function applyPluginExtensions(
    context: object,
    host: SmokeContextHost,
): asserts context is SmokeContext {
    // Extension names are runtime data. Registry validation guarantees their
    // shape; this is the single boundary that promotes the assembled context.
    const smokeContext = context as SmokeContext;
    for (const [name, factory] of host.extensions.actions) {
        assignDotted(smokeContext, name, async (...args: unknown[]) => {
            const value = await factory(smokeContext, ...args);
            if (isSmokeResource(value)) {
                host.addManagedResource(value);
            }
            return value;
        });
    }
    for (const [name, factory] of host.extensions.probes) {
        assignDotted(
            smokeContext,
            name,
            (...args: unknown[]) => factory(smokeContext, args.length <= 1 ? args[0] : args),
        );
    }
    for (const [name, factory] of host.extensions.resources) {
        assignDotted(smokeContext, name, async (...args: unknown[]) => {
            const resource = await factory(smokeContext, args.length <= 1 ? args[0] : args);
            if (isSmokeResource(resource)) {
                host.addManagedResource(resource);
            }
            return resource;
        });
    }
    for (const [name, factory] of host.extensions.recipes) {
        assignDotted(smokeContext, name, (options: unknown) => factory(smokeContext, options));
    }
}

function assignDotted(target: object, dottedName: string, value: unknown): void {
    const parts = dottedName.split('.').filter(Boolean);
    if (parts.length === 0) {
        throw new SmokeError(`Invalid plugin extension name: ${dottedName}`);
    }

    let cursor = target as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) {
        const existing = cursor[part];
        if (existing === undefined) {
            const next: Record<string, unknown> = {};
            cursor[part] = next;
            cursor = next;
            continue;
        }

        if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
            throw new SmokeError(
                `Plugin extension name conflicts with existing context property: ${dottedName}`,
            );
        }

        cursor = existing as Record<string, unknown>;
    }

    const leaf = parts[parts.length - 1];
    if (!leaf) {
        throw new SmokeError(`Invalid plugin extension name: ${dottedName}`);
    }
    if (cursor[leaf] !== undefined) {
        throw new SmokeError(`Duplicate plugin context extension: ${dottedName}`);
    }

    cursor[leaf] = value;
}

function isSmokeResource(value: unknown): value is SmokeResource {
    return typeof value === 'object' && value !== null && 'cleanup' in value;
}
