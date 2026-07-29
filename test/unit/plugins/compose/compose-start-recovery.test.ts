import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import composePlugin from '../../../../dist/plugins/compose.js';
import { createFakeDocker, readFakeDockerLog } from './fake-docker.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('compose startup preserves its failure when evidence and cleanup also fail', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-compose-recovery-'));
    const docker = await createFakeDocker(root, 'up-and-down-fail');

    smoke.use(composePlugin());
    smoke.suite('compose recovery failure', async (t) => {
        await t.compose.up({
            docker,
            projectName: 'Recovery Stack',
        });
    });

    try {
        const result = await runRegisteredSuites({
            repoRoot: root,
            eventSink: {
                emit(event) {
                    if (event.type === 'artifact.attached') {
                        throw new Error('artifact sink failed');
                    }
                },
            },
        });
        const error = result.suites[0]?.error;
        const log = await readFakeDockerLog(root);

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(error.message, /Docker Compose up failed with exit code 17/u);
        assert.deepEqual(error.details?.recoveryErrors, [
            { phase: 'evidence', message: 'artifact sink failed' },
            { phase: 'cleanup', message: 'Docker Compose down failed with exit code 18.' },
        ]);
        assert.ok(log.some((entry) => entry.args.includes('down')));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
