import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ReleaseMetadata } from './release-contract.mts';
import {
    releaseCommandSucceeds,
    runReleaseCommand,
} from './release-command.mts';
import { releaseVerificationFailures } from './release-verification.mts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tag = process.argv[2];
if (tag === undefined) {
    throw new Error('Usage: verify-release.mts <tag>');
}

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const lockPackages = readProperty(packageLock, 'packages');
const lockRoot = readProperty(lockPackages, '');
const metadata: ReleaseMetadata = {
    tag,
    packageName: readString(packageJson, 'name'),
    packageVersion: readString(packageJson, 'version'),
    lockName: readString(packageLock, 'name'),
    lockVersion: readString(packageLock, 'version'),
    lockRootName: readString(lockRoot, 'name'),
    lockRootVersion: readString(lockRoot, 'version'),
};
const tagType = gitOutput(['cat-file', '-t', `refs/tags/${tag}`]);
const tagger = gitOutput([
    'for-each-ref',
    '--format=%(taggername)%00%(taggeremail)',
    `refs/tags/${tag}`,
]);
const signatureOutput = gitTagSignature(tag);
const commit = gitOutput(['rev-list', '-n', '1', tag]);
const commitOnMain = releaseCommandSucceeds(
    'git',
    ['merge-base', '--is-ancestor', commit, 'origin/main'],
    root,
);
const notes = path.join(root, 'docs', 'releases', `${tag}.md`);
const failures = releaseVerificationFailures({
    metadata,
    tagType,
    tagger,
    signatureOutput,
    commitOnMain,
    releaseNotesPresent: await fileHasContent(notes),
});

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

function readString(value: unknown, key: string): string | undefined {
    const property = readProperty(value, key);
    return typeof property === 'string' ? property : undefined;
}

function gitOutput(args: readonly string[]): string {
    return runReleaseCommand('git', args, root).stdout.trim();
}

function gitTagSignature(releaseTag: string): string {
    try {
        const signature = runReleaseCommand(
            'git',
            ['verify-tag', '--raw', releaseTag],
            root,
        );
        return `${signature.stdout}\n${signature.stderr}`;
    } catch {
        return '';
    }
}

async function fileHasContent(file: string): Promise<boolean> {
    try {
        return (await readFile(file, 'utf8')).trim() !== '';
    } catch {
        return false;
    }
}
