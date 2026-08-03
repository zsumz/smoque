import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
    provenanceVerificationFailures,
    registryStateFailures,
} from '../../scripts/release/release-registry.mts';

describe('release registry contract', () => {
    test('accepts the expected public version and latest tag', () => {
        assert.deepEqual(registryStateFailures({
            packageName: 'smoque',
            expectedVersion: '0.1.1',
            publishedVersion: '0.1.1',
            latestVersion: '0.1.1',
        }), []);
    });

    test('rejects missing public versions and latest-tag drift', () => {
        assert.deepEqual(registryStateFailures({
            packageName: 'smoque',
            expectedVersion: '0.1.1',
            publishedVersion: '',
            latestVersion: '0.1.0',
        }), [
            'npm returned no version for smoque@0.1.1.',
            'npm latest is 0.1.0, expected 0.1.1.',
        ]);
    });

    test('requires verified provenance for the exact release', () => {
        const result = {
            invalid: [],
            missing: [],
            verified: [{
                name: 'smoque',
                version: '0.1.1',
                attestations: { provenance: { predicateType: 'slsa' } },
            }],
        };

        assert.deepEqual(
            provenanceVerificationFailures(result, 'smoque', '0.1.1'),
            [],
        );
        assert.deepEqual(
            provenanceVerificationFailures(result, 'smoque', '0.1.2'),
            ['npm did not verify provenance for smoque@0.1.2.'],
        );
        assert.deepEqual(
            provenanceVerificationFailures({ verified: [] }, 'smoque', '0.1.1'),
            ['npm did not verify provenance for smoque@0.1.1.'],
        );
        assert.deepEqual(provenanceVerificationFailures({
            verified: [{
                name: 'smoque',
                version: '0.1.1',
                attestations: { publish: {} },
            }],
        }, 'smoque', '0.1.1'), [
            'npm did not verify provenance for smoque@0.1.1.',
        ]);
    });
});
