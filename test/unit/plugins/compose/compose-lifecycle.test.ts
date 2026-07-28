import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'vitest';

import { resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../../dist/core.js';
import composePlugin from '../../../../dist/plugins/compose.js';
import httpPlugin from '../../../../dist/plugins/http.js';
import { createFakeDocker, readFakeDockerLog } from './fake-docker.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('compose plugin starts a project, exposes service ports, and cleans up', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-compose-'));
    const docker = await createFakeDocker(root);

    smoke.use(httpPlugin());
    smoke.use(composePlugin());
    smoke.suite('compose lifecycle', async (t) => {
        const info = await t.compose.check({ docker });
        assert.equal(info.docker.command, docker);
        assert.equal(info.compose.version, '2.27.0');

        const project = await t.compose.up({
            docker,
            file: 'compose.yaml',
            projectName: 'Smoke Demo',
            services: ['web'],
        });

        assert.equal(project.projectName, 'smoke-demo');
        assert.deepEqual(project.files, [join(root, 'compose.yaml')]);

        const web = project.service('web');
        const published = await web.port(8080);
        assert.equal(published.host, '127.0.0.1');
        assert.equal(published.port, 49154);
        assert.equal(await web.url(8080, '/health'), 'http://127.0.0.1:49154/health');
        assert.equal(
            web.ready(8080, { path: '/health' }).description,
            'docker compose service web:8080 HTTP ready',
        );
    });

    try {
        const result = await runRegisteredSuites({ repoRoot: root });
        const log = await readFakeDockerLog(root);

        assert.equal(result.status, 'passed');
        assert.ok(log.some((entry) => entry.args.join(' ') === 'compose version --short'));
        assert.ok(log.some((entry) => entry.args.includes('up') && entry.args.includes('--detach')));
        assert.ok(log.some((entry) => entry.args.includes('down') && entry.args.includes('--volumes')));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
