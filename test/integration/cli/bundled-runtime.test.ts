import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { cliResultSummary, runCli } from './cli-harness.js';

test('smoque run resolves bundled runtime imports without project install', async () => {
    const root = await mkdtemp(join(tmpdir(), 'smoque-cli-standalone-'));

    try {
        await mkdir(join(root, 'smoke'), { recursive: true });
        await writeFile(
            join(root, 'smoke', 'standalone.smoke.ts'),
            `
        import { expect, smoke, type SmokeContext } from "smoque";
        import { definePlugin } from "smoque/plugin";

        smoke.use(definePlugin({
          name: "fixture-plugin",
          register(registry) {
            registry.action("example.echo", (_t, value) => value);
          },
        }));

        smoke.suite("standalone bundled runtime smoke", async (t: SmokeContext & { example: { echo(value: string): Promise<string> } }) => {
          await t.step("standard primitives are available", () => {
            expect(typeof t.http.fakeServer).toBe("function");
          });

          await t.step("plugin subpath is available", async () => {
            expect(await t.example.echo("ok")).toBe("ok");
          });
        });
      `,
            'utf8',
        );

        const result = await runCli(['run'], root);

        assert.equal(result.exitCode, 0, cliResultSummary(result));
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /standalone bundled runtime smoke/u);
        assert.match(result.stdout, /PASS standard primitives are available/u);
        assert.match(result.stdout, /PASS plugin subpath is available/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
