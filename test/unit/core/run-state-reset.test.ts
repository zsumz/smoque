import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { isSnapshotUpdateMode } from '../../../dist/assertions/snapshot/update-mode.js';
import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('run failures always restore snapshot update mode', async () => {
    smoke.suite('event failure', () => undefined);

    await assert.rejects(
        async () => runRegisteredSuites({
            updateSnapshots: true,
            eventSink: {
                emit() {
                    throw new Error('event sink failed');
                },
            },
        }),
        /event sink failed/u,
    );

    assert.equal(isSnapshotUpdateMode(), false);
});
