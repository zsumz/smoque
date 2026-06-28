import { expect, smoke } from "smoque";

smoke.suite("standalone binary install smoke", { tags: ["binary", "package"] }, async (t) => {
  const install = await t.tempDir("standalone-smoque");
  const binary = install.path("smoque");
  const generator = t.repoRoot().path("scripts", "build-local-bin.mjs");

  await t.step("build local executable artifact", async () => {
    await t.cmd(process.execPath, [generator, "--output", binary]);
    await expect.file(binary).toBeExecutable({ args: ["--version"] });
  });

  await t.step("binary reports version", async () => {
    await expect.file(binary).toBeExecutable({ args: ["--version"] });
  });

  await t.step("binary doctor runs in a non-node project", async () => {
    const project = await t.fixture.fromTemplate(t.repoRoot().path("examples", "templates", "plain-service"), {
      tokens: {
        serviceName: "standalone",
        port: 9371,
      },
    });

    const result = await t.cmd(binary, ["doctor"], { cwd: project });
    expect.value(result.stdout).toContain("smoque doctor");
    expect.value(result.stdout).toContain("WARN package.json: not found");
  });

  await t.step("binary runs TypeScript smoke file", async () => {
    const project = await t.tempDir("standalone-ts-smoke");
    await t.fs.mkdir(project.path("smoke"));
    await t.fs.writeText(
      project.path("smoke", "project.smoke.ts"),
      [
        'import { expect, smoke } from "smoque";',
        "",
        'smoke.suite("standalone TypeScript project", async (t) => {',
        '  await t.step("typed smoke runs", async () => {',
        '    const value: string = "smoque";',
        '    expect.value(value).toBe("smoque");',
        "  });",
        "});",
        "",
      ].join("\n"),
    );

    const result = await t.cmd(binary, ["run"], { cwd: project });
    expect.value(result.stdout).toContain("standalone TypeScript project");
    expect.value(result.stdout).toContain("PASS typed smoke runs");
  });
});
