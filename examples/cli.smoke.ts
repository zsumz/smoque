import { smoke, expect } from "smoque";

smoke.suite("cli works", async (t) => {
  const root = t.repoRoot();

  await t.step("build CLI", async () => {
    await t.cmd("npm", ["run", "build"], { cwd: root });
  });

  await t.step("help works", async () => {
    const result = await t.cmd("node", ["dist/cli.js", "--help"], { cwd: root });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  await t.step("version works", async () => {
    const result = await t.cmd("node", ["dist/cli.js", "--version"], { cwd: root });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/u);
  });

  await t.step("bad command fails clearly", async () => {
    const result = await t.cmd("node", ["dist/cli.js", "does-not-exist"], {
      cwd: root,
      check: false,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown command");
  });
});
