import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    releaseContractFailures,
    releaseSignerEmail,
    releaseSignerFingerprint,
    releaseSignerName,
    type ReleaseMetadata,
} from './release-contract.mts';
import {
    releaseCommandSucceeds,
    runReleaseCommand,
} from './release-command.mts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tag = process.argv[2];
if (tag === undefined) {
    throw new Error('Usage: verify-release.mts <tag>');
}

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const lockRoot = readRecord(readProperty(packageLock, 'packages'), '');
const metadata: ReleaseMetadata = {
    tag,
    packageName: readString(packageJson, 'name'),
    packageVersion: readString(packageJson, 'version'),
    lockName: readString(packageLock, 'name'),
    lockVersion: readString(packageLock, 'version'),
    lockRootName: readString(lockRoot, 'name'),
    lockRootVersion: readString(lockRoot, 'version'),
};
const failures = releaseContractFailures(metadata);

if (gitOutput(['cat-file', '-t', `refs/tags/${tag}`]) !== 'tag') {
    failures.push(`${tag} must be an annotated tag.`);
}
const tagger = gitOutput([
    'for-each-ref',
    '--format=%(taggername)%00%(taggeremail)',
    `refs/tags/${tag}`,
]);
if (tagger !== `${releaseSignerName}\u0000<${releaseSignerEmail}>`) {
    failures.push(`${tag} must be tagged by ${releaseSignerName} <${releaseSignerEmail}>.`);
}
const signature = runReleaseCommand('git', ['verify-tag', '--raw', tag], root);
const signatureOutput = `${signature.stdout}\n${signature.stderr}`;
if (!signatureOutput.includes(`VALIDSIG ${releaseSignerFingerprint} `)) {
    failures.push(`${tag} must use the pinned release signing key.`);
}
const commit = gitOutput(['rev-list', '-n', '1', tag]);
if (!releaseCommandSucceeds(
    'git',
    ['merge-base', '--is-ancestor', commit, 'origin/main'],
    root,
)) {
    failures.push(`${tag} must point to a commit on origin/main.`);
}
const notes = path.join(root, 'docs', 'releases', `${tag}.md`);
if (!await fileHasContent(notes)) {
    failures.push(`docs/releases/${tag}.md must contain release notes.`);
}

if (failures.length > 0) {
    throw new Error(`Release verification failed:\n- ${failures.join('\n- ')}`);
}
console.log(`Verified ${tag} at ${commit}.`);

async function readJson(relative: string): Promise<unknown> {
    return JSON.parse(await readFile(path.join(root, relative), 'utf8')) as unknown;
}

function readProperty(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null && key in value
        ? value[key as keyof typeof value]
        : undefined;
}

function readRecord(value: unknown, key: string): unknown {
    return readProperty(value, key);
}

function readString(value: unknown, key: string): string | undefined {
    const property = readProperty(value, key);
    return typeof property === 'string' ? property : undefined;
}

function gitOutput(args: readonly string[]): string {
    return runReleaseCommand('git', args, root).stdout.trim();
}

async function fileHasContent(file: string): Promise<boolean> {
    try {
        return (await readFile(file, 'utf8')).trim() !== '';
    } catch {
        return false;
    }
}
