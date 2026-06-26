import { join } from 'node:path';

import { SmokeError } from '../../errors.js';
import { toPathString } from '../../shared/path-ref.js';
import type { PathRef, SmokeContext } from '../../types.js';
import {
    createNpmPackageExpectation,
    type NpmPackageExpectation,
} from './package-expectation.js';

export interface NpmFixtureOptions {
    dir?: string | PathRef;
    packageJson?: Record<string, unknown>;
    cache?: string | PathRef;
}

export interface InstallOptions {
    scripts?: 'ignore' | 'allow';
    ignoreScripts?: boolean;
    audit?: boolean;
    fund?: boolean;
    packageLock?: boolean;
}

export interface NpmFixture {
    path(...parts: string[]): string;
    install(tarball: string | PathRef, options?: InstallOptions): Promise<void>;
    package(packageName: string): NpmPackageExpectation;
    node: {
        inline(source: string): Promise<void>;
    };
}

export async function npmFixture(
    t: SmokeContext,
    options: NpmFixtureOptions = {},
): Promise<NpmFixture> {
    const root = options.dir ?? await t.tempDir('npm-fixture');
    const rootPath = toPathString(root);
    const cache = options.cache ?? await t.tempDir('npm-fixture-cache');
    const cachePath = toPathString(cache);
    let nextInlineScriptId = 1;

    await t.fs.mkdir(rootPath);
    await t.fs.writeJson(
        join(rootPath, 'package.json'),
        options.packageJson ?? {
            private: true,
            type: 'module',
            dependencies: {},
        },
    );

    return {
        path(...parts: string[]): string {
            return join(rootPath, ...parts);
        },
        async install(tarball, installOptions = {}): Promise<void> {
            const args = ['install', toPathString(tarball)];
            if (installScriptPolicy(installOptions) === 'ignore') {
                args.push('--ignore-scripts');
            }
            if (installOptions.audit === false) {
                args.push('--audit=false');
            }
            if (installOptions.fund === false) {
                args.push('--fund=false');
            }
            if (installOptions.packageLock === false) {
                args.push('--package-lock=false');
            }

            await t.cmd('npm', args, {
                cwd: rootPath,
                env: {
                    NPM_CONFIG_CACHE: cachePath,
                },
            });
        },
        package(packageName): NpmPackageExpectation {
            return createNpmPackageExpectation(rootPath, packageName);
        },
        node: {
            async inline(source: string): Promise<void> {
                const scriptPath = join(rootPath, '.smoque', `inline-${String(nextInlineScriptId++)}.mjs`);
                await t.fs.writeText(scriptPath, source);
                await t.cmd(process.execPath, [scriptPath], { cwd: rootPath });
            },
        },
    };
}

function installScriptPolicy(options: InstallOptions): 'ignore' | 'allow' {
    const scripts = options.scripts as string | undefined;
    if (scripts !== undefined) {
        if (scripts !== 'ignore' && scripts !== 'allow') {
            throw new SmokeError(`Unknown npm install scripts policy: ${scripts}`, {
                scripts,
                expected: ['ignore', 'allow'],
            });
        }
        return scripts;
    }

    if (options.ignoreScripts === false) {
        return 'allow';
    }

    return 'ignore';
}
