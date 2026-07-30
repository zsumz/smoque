import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
    isStableReleaseVersion,
    releaseContractFailures,
    type ReleaseMetadata,
} from '../../scripts/release/release-contract.mts';

const validMetadata: ReleaseMetadata = {
    tag: 'v0.1.1',
    packageName: 'smoque',
    packageVersion: '0.1.1',
    lockName: 'smoque',
    lockVersion: '0.1.1',
    lockRootName: 'smoque',
    lockRootVersion: '0.1.1',
};

describe('release contract', () => {
    test('accepts matching stable package metadata', () => {
        assert.deepEqual(releaseContractFailures(validMetadata), []);
    });

    test('rejects prerelease package versions', () => {
        const failures = releaseContractFailures({
            ...validMetadata,
            tag: 'v0.1.1-rc.0',
            packageVersion: '0.1.1-rc.0',
            lockVersion: '0.1.1-rc.0',
            lockRootVersion: '0.1.1-rc.0',
        });

        assert.deepEqual(failures, [
            'package version must be stable semantic versioning.',
        ]);
    });

    test('rejects tags that do not match the package version', () => {
        const failures = releaseContractFailures({
            ...validMetadata,
            tag: 'v0.1.2',
        });

        assert.deepEqual(failures, [
            'release tag must exactly match v<package version>.',
        ]);
    });

    test('rejects lockfile name and version drift', () => {
        const failures = releaseContractFailures({
            ...validMetadata,
            lockName: 'other',
            lockRootVersion: '0.1.0',
        });

        assert.deepEqual(failures, [
            'package-lock names must match package.json.',
            'package-lock versions must match package.json.',
        ]);
    });

    test('recognizes only stable semantic versions', () => {
        assert.equal(isStableReleaseVersion('0.1.1'), true);
        assert.equal(isStableReleaseVersion('1.0.0-rc.0'), false);
        assert.equal(isStableReleaseVersion('01.0.0'), false);
    });
});
