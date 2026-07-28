import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import type { ArtifactAttachedEvent } from '../../../../dist/events.js';
import composePlugin from '../../../../dist/plugins/compose.js';
import { createFakeDocker, readFakeDockerLog } from './fake-docker.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('compose plugin attaches logs and command history when startup fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-compose-failure-'));
    const docker = await createFakeDocker(root, 'up-fails');
    const artifacts: ArtifactAttachedEvent[] = [];

    smoke.use(composePlugin());
    smoke.suite('compose failure', async (t) => {
        await t.compose.up({
            docker,
            projectName: 'Failing Stack',
            services: ['api'],
        });
    });

    try {
        const result = await runRegisteredSuites({
            repoRoot: root,
            eventSink: {
                emit(event) {
                    if (event.type === 'artifact.attached') {
                        artifacts.push(event);
                    }
                },
            },
        });
        const error = result.suites[0]?.error;
        const logsArtifact = artifacts.find(
            (artifact) => artifact.name === 'failing-stack-compose-logs.txt',
        );
        const commandArtifact = artifacts.find(
            (artifact) => artifact.name === 'failing-stack-compose-commands.txt',
        );

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.match(error.message, /Docker Compose up failed/u);
        assert.ok(logsArtifact);
        assert.match(await readFile(logsArtifact.path, 'utf8'), /api \| boot failed/u);
        assert.ok(commandArtifact);
        assert.match(
            await readFile(commandArtifact.path, 'utf8'),
            /compose --project-name failing-stack up/u,
        );

        const log = await readFakeDockerLog(root);
        assert.ok(log.some((entry) => entry.args.includes('logs')));
        assert.ok(log.some((entry) => entry.args.includes('down')));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
