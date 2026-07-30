export const releasePackageName = 'smoque';
export const releaseSignerName = 'zsumz';
export const releaseSignerEmail = 'shawn@zsumz.com';
export const releaseSignerFingerprint =
    'B58439871CD2A7275B20CC19EC8E4D26598A0373';

const stableVersionPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export interface ReleaseMetadata {
    tag: string;
    packageName: string | undefined;
    packageVersion: string | undefined;
    lockName: string | undefined;
    lockVersion: string | undefined;
    lockRootName: string | undefined;
    lockRootVersion: string | undefined;
}

export function releaseContractFailures(
    metadata: ReleaseMetadata,
): string[] {
    const failures: string[] = [];
    if (metadata.packageName !== releasePackageName) {
        failures.push(`package name must be ${releasePackageName}.`);
    }
    if (
        metadata.packageVersion === undefined
        || !stableVersionPattern.test(metadata.packageVersion)
    ) {
        failures.push('package version must be stable semantic versioning.');
    }
    if (metadata.tag !== `v${metadata.packageVersion ?? ''}`) {
        failures.push('release tag must exactly match v<package version>.');
    }
    if (
        metadata.lockName !== metadata.packageName
        || metadata.lockRootName !== metadata.packageName
    ) {
        failures.push('package-lock names must match package.json.');
    }
    if (
        metadata.lockVersion !== metadata.packageVersion
        || metadata.lockRootVersion !== metadata.packageVersion
    ) {
        failures.push('package-lock versions must match package.json.');
    }
    return failures;
}

export function isStableReleaseVersion(version: string): boolean {
    return stableVersionPattern.test(version);
}
