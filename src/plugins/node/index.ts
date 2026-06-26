import { definePlugin } from '../../plugin.js';
import type { SmokePlugin } from '../../plugin.js';
import {
    npmFixture,
    type NpmFixture,
    type NpmFixtureOptions,
} from './npm-fixture.js';
import { npmPack, type NpmPackOptions, type PackedArtifact } from './npm-pack.js';

export type { InstallOptions, NpmFixture, NpmFixtureOptions } from './npm-fixture.js';
export type { NpmPackOptions, PackedArtifact } from './npm-pack.js';
export type { NpmPackageExpectation } from './package-expectation.js';

export interface NpmApi {
    pack(options?: NpmPackOptions): Promise<PackedArtifact>;
    fixture(options?: NpmFixtureOptions): Promise<NpmFixture>;
}

declare module '../../types.js' {
    interface SmokeContext {
        npm: NpmApi;
    }
}

export default function nodePlugin(): SmokePlugin {
    return definePlugin({
        name: 'smoque:node',
        version: '0.0.0',
        register(registry) {
            registry.action('npm.pack', async (t, options) => npmPack(t, options as NpmPackOptions | undefined));
            registry.action('npm.fixture', async (t, options) => npmFixture(t, options as NpmFixtureOptions | undefined));
        },
    });
}
