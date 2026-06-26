import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { isRecord } from '../../shared/objects.js';
import { toPathString } from '../../shared/path-ref.js';
import type { PathRef, SmokeContext } from '../../types.js';

export interface NpmPackOptions {
    cwd?: string | PathRef;
    destination?: string | PathRef;
    cache?: string | PathRef;
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

    const result = await t.cmd('npm', args, {
        cwd,
        env: {
            NPM_CONFIG_CACHE: toPathString(cache),
        },
    });
    const packResult = parsePackResult(result.stdout);
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

interface NpmPackJson {
    filename: string;
    name?: string;
    version?: string;
}

function parsePackResult(stdout: string): NpmPackJson {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout.trim());
    } catch {
        throw new Error(`npm pack did not return JSON output. Output was: ${stdout.slice(0, 500)}`);
    }

    const entry: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!isRecord(entry) || typeof entry.filename !== 'string') {
        throw new Error(`npm pack JSON did not include a tarball filename. Output was: ${stdout.slice(0, 500)}`);
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
