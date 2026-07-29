import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, runCli } from './cli-harness.js';

test('smoque init writes a runnable smoke scaffold and smoke conventions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-init-'));

    try {
        const result = await runCli(['init'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /Created smoke\/project\.smoke\.ts/u);
        assert.match(result.stdout, /Created smoke\/AGENTS\.md/u);
        assert.match(result.stdout, /Created smoke\/package\.json/u);
        assert.match(result.stdout, /Created smoke\/tsconfig\.json/u);
        assert.match(result.stdout, /Next: smoque list/u);
        assert.match(result.stdout, /Next: smoque run/u);

        const smokeFile = await readFile(join(root, 'smoke', 'project.smoke.ts'), 'utf8');
        assert.match(smokeFile, /import \{ smoke, type SmokeContext \} from "smoque";/u);
        assert.match(smokeFile, /smoke\.suite\("project smoke"/u);
        assert.match(
            smokeFile,
            /async function assertNodeAvailable\(t: SmokeContext\): Promise<void>/u,
        );

        const agents = await readFile(join(root, 'smoke', 'AGENTS.md'), 'utf8');
        assert.match(agents, /^# Smoke Test Conventions/mu);

        const packageJson = JSON.parse(
            await readFile(join(root, 'smoke', 'package.json'), 'utf8'),
        ) as unknown;
        assert.deepEqual(packageJson, { private: true, type: 'module' });

        const tsconfig = await readFile(join(root, 'smoke', 'tsconfig.json'), 'utf8');
        assert.match(tsconfig, /"erasableSyntaxOnly": true/u);
        assert.match(tsconfig, /"module": "NodeNext"/u);
        assert.match(tsconfig, /"moduleResolution": "NodeNext"/u);
        assert.match(tsconfig, /"verbatimModuleSyntax": true/u);
        assert.match(tsconfig, /"\*\*\/\*\.mts"/u);

        const listed = await runCli(['list'], root);

        assert.equal(listed.exitCode, 0, cliResultSummary(listed));
        assert.equal(listed.stderr, '');
        assert.match(listed.stdout, /^project smoke\tsmoke\/project\.smoke\.ts\t-$/mu);

        const ran = await runCli(['run'], root);

        assert.equal(ran.exitCode, 0, cliResultSummary(ran));
        assert.equal(ran.stderr, '');
        assert.match(ran.stdout, /PASS node is available/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('smoque init skips existing scaffold files unless forced', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-init-existing-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(join(root, 'smoke', 'project.smoke.ts'), '// Existing smoke\n', 'utf8');
        await writeFile(join(root, 'smoke', 'AGENTS.md'), '# Existing agents\n', 'utf8');
        await writeFile(join(root, 'smoke', 'package.json'), '{}\n', 'utf8');
        await writeFile(join(root, 'smoke', 'tsconfig.json'), '{}\n', 'utf8');

        const skipped = await runCli(['init'], root);

        assert.equal(skipped.exitCode, 0, cliResultSummary(skipped));
        assert.match(skipped.stdout, /Skipped smoke\/project\.smoke\.ts; already exists\./u);
        assert.match(skipped.stdout, /Skipped smoke\/AGENTS\.md; already exists\./u);
        assert.match(skipped.stdout, /Skipped smoke\/package\.json; already exists\./u);
        assert.match(skipped.stdout, /Skipped smoke\/tsconfig\.json; already exists\./u);
        assert.match(skipped.stdout, /Re-run with --force/u);
        assert.equal(
            await readFile(join(root, 'smoke', 'project.smoke.ts'), 'utf8'),
            '// Existing smoke\n',
        );
        assert.equal(await readFile(join(root, 'smoke', 'AGENTS.md'), 'utf8'), '# Existing agents\n');
        assert.equal(await readFile(join(root, 'smoke', 'package.json'), 'utf8'), '{}\n');
        assert.equal(await readFile(join(root, 'smoke', 'tsconfig.json'), 'utf8'), '{}\n');

        const forced = await runCli(['init', '--force'], root);

        assert.equal(forced.exitCode, 0, cliResultSummary(forced));
        assert.match(forced.stdout, /Wrote smoke\/project\.smoke\.ts/u);
        assert.match(forced.stdout, /Wrote smoke\/AGENTS\.md/u);
        assert.match(forced.stdout, /Wrote smoke\/package\.json/u);
        assert.match(forced.stdout, /Wrote smoke\/tsconfig\.json/u);
        assert.match(await readFile(join(root, 'smoke', 'project.smoke.ts'), 'utf8'), /project smoke/u);
        assert.match(
            await readFile(join(root, 'smoke', 'AGENTS.md'), 'utf8'),
            /^# Smoke Test Conventions/mu,
        );
        assert.match(
            await readFile(join(root, 'smoke', 'package.json'), 'utf8'),
            /"type": "module"/u,
        );
        assert.match(
            await readFile(join(root, 'smoke', 'tsconfig.json'), 'utf8'),
            /"erasableSyntaxOnly": true/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
