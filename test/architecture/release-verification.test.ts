import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
    releaseSignerEmail,
    releaseSignerFingerprint,
    releaseSignerName,
    type ReleaseMetadata,
} from '../../scripts/release/release-contract.mts';
import {
    releaseVerificationFailures,
    type ReleaseVerificationFacts,
} from '../../scripts/release/release-verification.mts';

const metadata: ReleaseMetadata = {
    tag: 'v0.1.1',
    packageName: 'smoque',
    packageVersion: '0.1.1',
    lockName: 'smoque',
    lockVersion: '0.1.1',
    lockRootName: 'smoque',
    lockRootVersion: '0.1.1',
};
const validFacts: ReleaseVerificationFacts = {
    metadata,
    tagType: 'tag',
    tagger: `${releaseSignerName}\u0000<${releaseSignerEmail}>`,
    signatureOutput: `[GNUPG:] VALIDSIG ${releaseSignerFingerprint} 2026`,
    commitOnMain: true,
    releaseNotesPresent: true,
};

describe('release verification contract', () => {
    test('accepts a signed annotated release on main with notes', () => {
        assert.deepEqual(releaseVerificationFailures(validFacts), []);
    });

    test('reports every release identity and ancestry violation', () => {
        assert.deepEqual(releaseVerificationFailures({
            ...validFacts,
            tagType: 'commit',
            tagger: 'other\u0000<other@example.com>',
            signatureOutput: '',
            commitOnMain: false,
            releaseNotesPresent: false,
        }), [
            'v0.1.1 must be an annotated tag.',
            'v0.1.1 must be tagged by zsumz <shawn@zsumz.com>.',
            'v0.1.1 must use the pinned release signing key.',
            'v0.1.1 must point to a commit on origin/main.',
            'docs/releases/v0.1.1.md must contain release notes.',
        ]);
    });
});
