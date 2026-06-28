import { expect, smoke } from "smoque";

smoke.suite("packed smoque tarball installs a runnable bin", { tags: ["package"] }, async (t) => {
  const root = t.repoRoot();
  const work = await t.tempDir("tarball-install");
  const packed = work.path("packed");
  const consumerDir = work.path("consumer");

  await t.step("build smoque package", async () => {
    await t.cmd("npm", ["run", "build"], { cwd: root });
  });

  await t.step("prepare install workspace", async () => {
    await t.fs.mkdir(packed);
  });

  const tarball = await t.step("pack smoque package", async () => {
    return await t.npm.pack({
      cwd: root,
      destination: packed,
    });
  });

  const consumer = await t.step("create clean consumer project", async () => {
    return await t.npm.fixture({
      dir: consumerDir,
      packageJson: {
        private: true,
        type: "module",
        dependencies: {},
      },
    });
  });

  const smoqueBin = () =>
    consumer.path("node_modules", ".bin", process.platform === "win32" ? "smoque.cmd" : "smoque");

  await t.step("install tarball into consumer", async () => {
    await attachInstallContext(t, tarball.path, consumer.path(), smoqueBin());
    await consumer.install(tarball.path, {
      scripts: "ignore",
      audit: false,
      fund: false,
      packageLock: false,
    });
  });

  await t.step("installed smoque bin reports version", async () => {
    await attachInstallContext(t, tarball.path, consumer.path(), smoqueBin());
    const result = await t.cmd(smoqueBin(), ["--version"], {
      cwd: consumer.path(),
    });

    expect.value(result.stdout.trim()).toBe(tarball.version);
  });

  await t.step("installed smoque bin init creates smoke files", async () => {
    await attachInstallContext(t, tarball.path, consumer.path(), smoqueBin());
    const result = await t.cmd(smoqueBin(), ["init"], {
      cwd: consumer.path(),
    });

    expect.value(result.stdout).toContain("Created smoke/project.smoke.ts");
    await expect.file(consumer.path("smoke", "project.smoke.ts")).toExist();
    await expect.file(consumer.path("smoke", "AGENTS.md")).toExist();
  });

  await t.step("installed smoque bin doctor sees runnable project", async () => {
    await attachInstallContext(t, tarball.path, consumer.path(), smoqueBin());
    const result = await t.cmd(smoqueBin(), ["doctor"], {
      cwd: consumer.path(),
    });

    expect.value(result.stdout).toContain("smoque doctor");
    expect.value(result.stdout).toContain("OK   node:");
    expect.value(result.stdout).toContain("OK   typescript smoke files:");
    expect.value(result.stdout).toContain("OK   smoke files: 1 found.");
  });

  await t.step("installed smoque bin run executes generated smoke", async () => {
    await attachInstallContext(t, tarball.path, consumer.path(), smoqueBin());
    const result = await t.cmd(smoqueBin(), ["run", "smoke/"], {
      cwd: consumer.path(),
    });

    expect.value(result.stdout).toContain("project smoke");
    expect.value(result.stdout).toContain("PASS node is available");
  });
});

async function attachInstallContext(t, tarballPath, consumerPath, binPath) {
  await t.attach.text(
    "tarball-install-context.txt",
    [
      `tarball=${tarballPath}`,
      `consumer=${consumerPath}`,
      `bin=${binPath}`,
      "",
    ].join("\n"),
  );
}
