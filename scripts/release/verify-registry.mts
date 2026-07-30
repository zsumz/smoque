import { access, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { releasePackageName, isStableReleaseVersion } from './release-contract.mts';
import { runReleaseCommand } from './release-command.mts';

const version = process.argv[2];
const outputDirectory = process.argv[3];
if (
    version === undefined
    || outputDirectory === undefined
    || !isStableReleaseVersion(version)
) {
    throw new Error('Usage: verify-registry.mts <stable-version> <output-directory>');
}

const published = npmOutput([
    'view',
    `${releasePackageName}@${version}`,
    'version',
]);
if (published !== version) {
    throw new Error(`npm returned ${published || 'no version'} for ${releasePackageName}@${version}.`);
}
const latest = npmOutput(['view', releasePackageName, 'dist-tags.latest']);
if (latest !== version) {
    throw new Error(`npm latest is ${latest || 'unset'}, expected ${version}.`);
}
runReleaseCommand('npm', [
    'pack',
    `${releasePackageName}@${version}`,
    '--ignore-scripts',
    '--pack-destination',
    outputDirectory,
    '--cache',
    path.join(outputDirectory, '.npm-cache'),
], process.cwd());
const tarball = path.resolve(
    outputDirectory,
    `${releasePackageName}-${version}.tgz`,
);
await access(tarball);

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput === undefined) {
    console.log(`tarball=${tarball}`);
} else {
    await appendFile(githubOutput, `tarball=${tarball}\n`);
}
console.log(`Verified npm registry state for ${releasePackageName}@${version}.`);

function npmOutput(args: readonly string[]): string {
    return runReleaseCommand('npm', args, process.cwd()).stdout.trim();
}
