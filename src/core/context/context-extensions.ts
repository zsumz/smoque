import { SmokeError } from '../../errors.js';
import type { SmokeContext, SmokeResource } from '../../types.js';
import type { SmokeContextHost } from './smoke-context.js';

export function applyPluginExtensions(
    context: SmokeContext,
    host: SmokeContextHost,
): void {
    for (const [name, factory] of host.extensions.actions) {
        assignDotted(context, name, async (...args: unknown[]) => {
            const value = await factory(context, ...args);
            if (isSmokeResource(value)) {
                host.addManagedResource(value);
            }
            return value;
        });
    }
    for (const [name, factory] of host.extensions.probes) {
        assignDotted(
            context,
            name,
            (...args: unknown[]) => factory(context, args.length <= 1 ? args[0] : args),
        );
    }
    for (const [name, factory] of host.extensions.resources) {
        assignDotted(context, name, async (...args: unknown[]) => {
            const resource = await factory(context, args.length <= 1 ? args[0] : args);
            if (isSmokeResource(resource)) {
                host.addManagedResource(resource);
            }
            return resource;
        });
    }
    for (const [name, factory] of host.extensions.recipes) {
        assignDotted(context, name, (options: unknown) => factory(context, options));
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
