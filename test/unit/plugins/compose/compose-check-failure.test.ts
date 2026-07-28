import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import composePlugin from '../../../../dist/plugins/compose.js';
import { createFakeDocker } from './fake-docker.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('compose plugin reports missing support with installation diagnostics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-compose-missing-'));
    const docker = await createFakeDocker(root, 'missing-compose');

    smoke.use(composePlugin());
    smoke.suite('compose missing', async (t) => {
        await t.compose.check({ docker });
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const error = result.suites[0]?.error;

        assert.equal(result.status, 'failed');
        assert.ok(error);
        assert.equal(error.name, 'SmokeError');
        assert.match(error.message, /Docker Compose is not available/u);
        assert.match(String(error.details?.installHint), /Docker Desktop/u);
        assert.equal(error.details?.exitCode, 42);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
