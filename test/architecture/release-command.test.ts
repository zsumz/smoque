import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
    releaseCommandSucceeds,
    runReleaseCommand,
} from '../../scripts/release/release-command.mts';

describe('release command execution', () => {
    test('reports executable startup failures without masking them', () => {
        const missingCommand = `missing-smoque-release-command-${String(process.pid)}`;

        assert.throws(
            () => runReleaseCommand(missingCommand, [], process.cwd()),
            (error: unknown) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /Release command failed:/u);
                assert.match(error.message, /ENOENT/u);
                assert.doesNotMatch(error.message, /Cannot read properties/u);
                return true;
            },
        );
        assert.equal(
            releaseCommandSucceeds(missingCommand, [], process.cwd()),
            false,
        );
    });

    test('retains command output in nonzero exit failures', () => {
        assert.throws(
            () => runReleaseCommand(process.execPath, [
                '--input-type=module',
                '--eval',
                'console.log("release stdout"); console.error("release stderr"); process.exit(7);',
            ], process.cwd()),
            (error: unknown) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /release stdout/u);
                assert.match(error.message, /release stderr/u);
                return true;
            },
        );
    });
});
