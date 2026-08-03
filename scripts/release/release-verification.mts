import {
    releaseContractFailures,
    releaseSignerEmail,
    releaseSignerFingerprint,
    releaseSignerName,
    type ReleaseMetadata,
} from './release-contract.mts';

export interface ReleaseVerificationFacts {
    metadata: ReleaseMetadata;
    tagType: string;
    tagger: string;
    signatureOutput: string;
    commitOnMain: boolean;
    releaseNotesPresent: boolean;
}

export function releaseVerificationFailures(
    facts: ReleaseVerificationFacts,
): string[] {
    const failures = releaseContractFailures(facts.metadata);
    const { tag } = facts.metadata;

    if (facts.tagType !== 'tag') {
        failures.push(`${tag} must be an annotated tag.`);
    }
    if (facts.tagger !== `${releaseSignerName}\u0000<${releaseSignerEmail}>`) {
        failures.push(
            `${tag} must be tagged by ${releaseSignerName} <${releaseSignerEmail}>.`,
        );
    }
    if (!facts.signatureOutput.includes(`VALIDSIG ${releaseSignerFingerprint} `)) {
        failures.push(`${tag} must use the pinned release signing key.`);
    }
    if (!facts.commitOnMain) {
        failures.push(`${tag} must point to a commit on origin/main.`);
    }
    if (!facts.releaseNotesPresent) {
        failures.push(`docs/releases/${tag}.md must contain release notes.`);
    }
    return failures;
}
