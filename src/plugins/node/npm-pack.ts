import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { SmokeError } from '../../errors.js';
import { isRecord } from '../../shared/objects.js';
import { toPathString } from '../../shared/path-ref.js';
import type { PathRef, SmokeContext } from '../../types.js';

export interface NpmPackOptions {
    cwd?: string | PathRef;
    destination?: string | PathRef;
    cache?: string | PathRef;
    scripts?: 'allow' | 'ignore';
    ignoreScripts?: boolean;
}

export interface PackedArtifact {
    filename: string;
    path: string;
    packageName?: string;
    version?: string;
}

export async function npmPack(
    t: SmokeContext,
    options: NpmPackOptions = {},
): Promise<PackedArtifact> {
    const cwd = toPathString(options.cwd ?? t.repoRoot());
    const args = ['pack', '--json'];
    const destination = options.destination === undefined ? undefined : toPathString(options.destination);
    const cache = options.cache ?? await t.tempDir('npm-pack-cache');
    if (destination !== undefined) {
        args.push('--pack-destination', destination);
    }
    const scripts = packScriptPolicy(options);
    if (scripts === 'ignore') {
        args.push('--ignore-scripts');
    }

    const result = await t.cmd('npm', args, {
        cwd,
        check: false,
        env: {
            NPM_CONFIG_CACHE: toPathString(cache),
        },
    });
    if (result.exitCode !== 0) {
        throw new SmokeError(`npm pack failed with exit code ${String(result.exitCode)}.`, {
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            scripts,
            stdout: result.stdout,
            stderr: result.stderr,
        });
    }

    const packResult = parsePackResult(result.stdout, result.stderr);
    const artifactPath = resolve(cwd, destination ?? '.', packResult.filename);

    try {
        await access(artifactPath);
    } catch {
        throw new Error(`npm pack reported ${packResult.filename}, but no tarball was found at ${artifactPath}.`);
    }

    const artifact: PackedArtifact = {
        filename: packResult.filename,
        path: artifactPath,
    };
    if (packResult.name !== undefined) {
        artifact.packageName = packResult.name;
    }
    if (packResult.version !== undefined) {
        artifact.version = packResult.version;
    }

    return artifact;
}

function packScriptPolicy(options: NpmPackOptions): 'allow' | 'ignore' {
    const scripts = options.scripts as string | undefined;
    if (scripts !== undefined) {
        if (scripts !== 'allow' && scripts !== 'ignore') {
            throw new SmokeError(`Unknown npm pack scripts policy: ${scripts}`, {
                scripts,
                expected: ['allow', 'ignore'],
            });
        }
        return scripts;
    }

    return options.ignoreScripts === true ? 'ignore' : 'allow';
}

interface NpmPackJson {
    filename: string;
    name?: string;
    version?: string;
}

function parsePackResult(stdout: string, stderr: string): NpmPackJson {
    let parsed: unknown;
    try {
        parsed = parseNpmJsonOutput(stdout);
    } catch {
        throw new SmokeError('npm pack did not return parseable JSON output.', {
            stdout,
            stderr,
            hint: 'npm lifecycle script output may have been written before npm pack JSON output.',
        });
    }

    const entry: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!isRecord(entry) || typeof entry.filename !== 'string') {
        throw new SmokeError('npm pack JSON did not include a tarball filename.', {
            stdout,
            stderr,
            parsed,
        });
    }

    const packResult: NpmPackJson = {
        filename: entry.filename,
    };
    if (typeof entry.name === 'string') {
        packResult.name = entry.name;
    }
    if (typeof entry.version === 'string') {
        packResult.version = entry.version;
    }

    return packResult;
}

function parseNpmJsonOutput(stdout: string): unknown {
    const trimmed = stdout.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        for (let index = trimmed.length - 1; index >= 0; index -= 1) {
            const character = trimmed[index];
            if (character !== '[' && character !== '{') {
                continue;
            }
            try {
                return JSON.parse(trimmed.slice(index));
            } catch {
                // Keep scanning for the JSON payload npm writes after lifecycle output.
            }
        }
        throw new Error('No parseable npm JSON payload found.');
    }
}
