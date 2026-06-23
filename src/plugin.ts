import type { ArtifactSink, Probe, SmokeContext, SmokeResource } from './types.js';

export interface SmokePlugin {
    readonly name: string;
    readonly version?: string;
    register(registry: PluginRegistry): void | Promise<void>;
}

export interface PluginRegistry {
    resource<T extends SmokeResource>(name: string, factory: ResourceFactory<T>): void;
    action<T>(name: string, action: ActionFactory<T>): void;
    probe<T extends Probe>(name: string, factory: ProbeFactory<T>): void;
    recipe<T>(name: string, recipe: RecipeFactory<T>): void;
}

export type ResourceFactory<T extends SmokeResource> = (context: SmokeContext, options?: unknown) => Promise<T> | T;

export type ActionFactory<T> = (context: SmokeContext, ...args: unknown[]) => Promise<T> | T;

export type ProbeFactory<T extends Probe> = (context: SmokeContext, options?: unknown) => T;

export type RecipeFactory<T> = (context: SmokeContext, options: unknown) => Promise<T> | T;

export function definePlugin(plugin: SmokePlugin): SmokePlugin {
    return plugin;
}

export interface ArtifactAwareResource extends SmokeResource {
    attachOnFailure(attach: ArtifactSink): Promise<void>;
}
