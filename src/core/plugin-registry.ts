import { SmokeError } from '../errors.js';
import type { ActionFactory, PluginRegistry, ProbeFactory, RecipeFactory, ResourceFactory } from '../plugin.js';
import type { Probe, SmokeResource } from '../types.js';

export interface ExtensionBucket {
    resources: Map<string, ResourceFactory<SmokeResource>>;
    actions: Map<string, ActionFactory<unknown>>;
    probes: Map<string, ProbeFactory<Probe>>;
    recipes: Map<string, RecipeFactory<unknown>>;
}

export function createExtensionBucket(): ExtensionBucket {
    return {
        resources: new Map(),
        actions: new Map(),
        probes: new Map(),
        recipes: new Map(),
    };
}

export function cloneExtensionBucket(extensions: ExtensionBucket): ExtensionBucket {
    return {
        resources: new Map(extensions.resources),
        actions: new Map(extensions.actions),
        probes: new Map(extensions.probes),
        recipes: new Map(extensions.recipes),
    };
}

export function clearExtensionBucket(extensions: ExtensionBucket): void {
    extensions.resources.clear();
    extensions.actions.clear();
    extensions.probes.clear();
    extensions.recipes.clear();
}

export function createPluginRegistry(extensions: ExtensionBucket, pluginName = '<anonymous plugin>'): PluginRegistry {
    return {
        resource(name, factory): void {
            validateExtensionRegistration(extensions, pluginName, 'resource', name);
            extensions.resources.set(name, factory);
        },
        action(name, action): void {
            validateExtensionRegistration(extensions, pluginName, 'action', name);
            extensions.actions.set(name, action);
        },
        probe(name, factory): void {
            validateExtensionRegistration(extensions, pluginName, 'probe', name);
            extensions.probes.set(name, factory);
        },
        recipe(name, recipe): void {
            validateExtensionRegistration(extensions, pluginName, 'recipe', name);
            extensions.recipes.set(name, recipe);
        },
    };
}

type ExtensionKind = 'action' | 'probe' | 'recipe' | 'resource';

const unsafeNameParts = new Set(['__proto__', 'prototype', 'constructor']);
const builtInContextProperties = new Set([
    'attach',
    'cleanup',
    'cmd',
    'env',
    'fail',
    'fixture',
    'fs',
    'log',
    'net',
    'poll',
    'ports',
    'process',
    'redact',
    'repoRoot',
    'sh',
    'skip',
    'step',
    'suite',
    'tcp',
    'tempDir',
    'tools',
    'workDir',
]);

function validateExtensionRegistration(
    extensions: ExtensionBucket,
    pluginName: string,
    kind: ExtensionKind,
    name: string,
): void {
    validateExtensionName(pluginName, kind, name);

    for (const [existingKind, existing] of extensionMaps(extensions)) {
        if (existing.has(name)) {
            throw new SmokeError(
                `Plugin "${pluginName}" registered duplicate ${kind} extension "${name}"; already registered as ${existingKind}.`,
                { plugin: pluginName, extension: name, kind, existingKind },
            );
        }

        for (const existingName of existing.keys()) {
            if (hasPrefixConflict(name, existingName)) {
                throw new SmokeError(
                    `Plugin "${pluginName}" registered ${kind} extension "${name}" that conflicts with ${existingKind} extension "${existingName}".`,
                    {
                        plugin: pluginName,
                        extension: name,
                        kind,
                        existingExtension: existingName,
                        existingKind,
                    },
                );
            }
        }
    }
}

function validateExtensionName(pluginName: string, kind: ExtensionKind, name: string): void {
    const parts = name.split('.');
    const invalidPart = parts.find((part) => part === '' || unsafeNameParts.has(part));
    if (invalidPart !== undefined) {
        throw new SmokeError(
            `Plugin "${pluginName}" registered invalid ${kind} extension "${name}".`,
            { plugin: pluginName, extension: name, kind },
        );
    }

    const root = parts[0];
    if (root && builtInContextProperties.has(root)) {
        throw new SmokeError(
            `Plugin "${pluginName}" registered ${kind} extension "${name}" that conflicts with built-in context property "${root}".`,
            { plugin: pluginName, extension: name, kind, property: root },
        );
    }
}

function extensionMaps(extensions: ExtensionBucket): Array<[ExtensionKind, Map<string, unknown>]> {
    return [
        ['resource', extensions.resources],
        ['action', extensions.actions],
        ['probe', extensions.probes],
        ['recipe', extensions.recipes],
    ];
}

function hasPrefixConflict(name: string, existingName: string): boolean {
    return name.startsWith(`${existingName}.`) || existingName.startsWith(`${name}.`);
}
