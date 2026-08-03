import {
    access,
    appendFile,
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { releasePackageName, isStableReleaseVersion } from './release-contract.mts';
import { runReleaseCommand } from './release-command.mts';
import {
    provenanceVerificationFailures,
    registryStateFailures,
} from './release-registry.mts';

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
const latest = npmOutput(['view', releasePackageName, 'dist-tags.latest']);
const stateFailures = registryStateFailures({
    packageName: releasePackageName,
    expectedVersion: version,
    publishedVersion: published,
    latestVersion: latest,
});
if (stateFailures.length > 0) {
    throw new Error(stateFailures.join('\n'));
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
await verifyProvenance(version, outputDirectory);

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

async function verifyProvenance(
    releaseVersion: string,
    outputRoot: string,
): Promise<void> {
    const auditRoot = await mkdtemp(path.join(outputRoot, 'smoque-audit-'));
    const cache = path.join(auditRoot, '.npm-cache');
    try {
        await writeFile(
            path.join(auditRoot, 'package.json'),
            `${JSON.stringify({
                private: true,
                dependencies: { [releasePackageName]: releaseVersion },
            }, null, 2)}\n`,
        );
        runReleaseCommand('npm', [
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--cache',
            cache,
        ], auditRoot);
        const audit = runReleaseCommand('npm', [
            'audit',
            'signatures',
            '--json',
            '--include-attestations',
            '--cache',
            cache,
        ], auditRoot);
        const failures = provenanceVerificationFailures(
            JSON.parse(audit.stdout) as unknown,
            releasePackageName,
            releaseVersion,
        );
        if (failures.length > 0) {
            throw new Error(failures.join('\n'));
        }
    } finally {
        await rm(auditRoot, { recursive: true, force: true });
    }
}
