import { expect, smoke } from "smoque";

smoke.suite("CLI init scaffolds smoke conventions", async (t) => {
  const root = t.repoRoot();
  const project = await t.tempDir("cli-init");
  const cli = root.path("dist", "cli", "main.js");

  await t.step("create project metadata", async () => {
    await t.fs.writeJson(project.path("package.json"), { name: "cli-init-dogfood" });
  });

  await t.step("initialize smoke scaffold", async () => {
    const result = await t.cmd("node", [cli, "init"], { cwd: project });

    expect.value(result.stdout).toMatch(/Created smoke\/project\.smoke\.ts/u);
    expect.value(result.stdout).toMatch(/Created smoke\/AGENTS\.md/u);
  });

  await t.step("scaffold contains runnable smoke file", async () => {
    const smokeFile = project.path("smoke", "project.smoke.ts");

    await expect
      .file(smokeFile)
      .toContain('import { smoke, type SmokeContext } from "smoque";');
    await expect
      .file(smokeFile)
      .toContain("async function assertNodeAvailable(t: SmokeContext): Promise<void>");
  });

  await t.step("scaffold contains smoke conventions", async () => {
    const agentsFile = project.path("smoke", "AGENTS.md");

    await expect.file(agentsFile).toContain("Use `smoque`.");
    await expect.file(agentsFile).toContain("Name files `*.smoke.ts`");
  });

  await t.step("doctor recognizes scaffold", async () => {
    const result = await t.cmd("node", [cli, "doctor"], { cwd: project });

    expect.value(result.stdout).toMatch(/OK\s+package\.json: found cli-init-dogfood/u);
    expect.value(result.stdout).toMatch(/OK\s+smoke files: 1 found\./u);
    expect.value(result.stdout).toMatch(/OK\s+smoke\/AGENTS\.md: found\./u);
  });
});
