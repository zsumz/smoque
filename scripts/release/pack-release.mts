import { appendFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runReleaseCommand } from './release-command.mts';

const outputDirectory = process.argv[2];
if (outputDirectory === undefined) {
    throw new Error('Usage: pack-release.mts <output-directory>');
}

const result = runReleaseCommand('npm', [
    'pack',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    outputDirectory,
    '--cache',
    path.join(outputDirectory, '.npm-cache'),
], process.cwd());
const packResult: unknown = JSON.parse(result.stdout);
const filename = readPackFilename(packResult);
const tarball = path.resolve(outputDirectory, filename);
const sha256 = createHash('sha256')
    .update(await readFile(tarball))
    .digest('hex');
const output = `tarball=${tarball}\nsha256=${sha256}\n`;
const githubOutput = process.env.GITHUB_OUTPUT;

if (githubOutput === undefined) {
    console.log(output.trim());
} else {
    await appendFile(githubOutput, output);
}

function readPackFilename(value: unknown): string {
    if (!Array.isArray(value) || value.length !== 1) {
        throw new Error('npm pack must return exactly one package.');
    }
    const entry: unknown = value[0];
    if (
        typeof entry !== 'object'
        || entry === null
        || !('filename' in entry)
        || typeof entry.filename !== 'string'
    ) {
        throw new Error('npm pack did not return a package filename.');
    }
    return entry.filename;
}
