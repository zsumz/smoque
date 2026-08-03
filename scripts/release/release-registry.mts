export interface RegistryState {
    packageName: string;
    expectedVersion: string;
    publishedVersion: string;
    latestVersion: string;
}

export function registryStateFailures(state: RegistryState): string[] {
    const failures: string[] = [];
    if (state.publishedVersion !== state.expectedVersion) {
        failures.push(
            `npm returned ${state.publishedVersion || 'no version'} for ${state.packageName}@${state.expectedVersion}.`,
        );
    }
    if (state.latestVersion !== state.expectedVersion) {
        failures.push(
            `npm latest is ${state.latestVersion || 'unset'}, expected ${state.expectedVersion}.`,
        );
    }
    return failures;
}

export function provenanceVerificationFailures(
    value: unknown,
    packageName: string,
    packageVersion: string,
): string[] {
    const verified = readProperty(value, 'verified');
    if (!Array.isArray(verified)) {
        return [`npm did not verify provenance for ${packageName}@${packageVersion}.`];
    }
    const verifiedEntries = verified as unknown[];
    const matchingPackage = verifiedEntries.find(
        (entry) => readProperty(entry, 'name') === packageName
            && readProperty(entry, 'version') === packageVersion,
    );
    const attestations = readProperty(matchingPackage, 'attestations');
    const provenance = readProperty(attestations, 'provenance');
    if (typeof provenance !== 'object' || provenance === null) {
        return [`npm did not verify provenance for ${packageName}@${packageVersion}.`];
    }
    return [];
}

function readProperty(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null && key in value
        ? value[key as keyof typeof value]
        : undefined;
}
