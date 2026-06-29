import { smoke, expect } from "smoque";

smoke.suite("java executable jar", async (t) => {
  const root = t.repoRoot();
  const java = await t.tools.java({ minVersion: 21 });
  await t.tools.jar({ minVersion: 21 });

  const work = await t.workDir("target/smoke/java-app", {
    clean: true,
    refuse: [".", "/", root],
  });

  await t.step("copy example project", async () => {
    await t.fs.copy(root.path("examples/java-app"), work.path());
  });

  await t.step("package jar", async () => {
    await t.cmd("./mvnw", ["package"], {
      cwd: work,
      timeout: "90s",
    });
  });

  const jarPath = work.path("target/example-app.jar");

  await t.step("jar contains generated metadata", async () => {
    await expect.archive(jarPath).toContainEntries([
      "BOOT-INF/classes/META-INF/build-info.properties",
      "BOOT-INF/classes/application.properties",
    ]);
  });

  await t.step("jar starts", async () => {
    const result = await t.cmd(java.command, ["-jar", jarPath, "--spring.main.web-application-type=none"], {
      cwd: work,
      timeout: "45s",
    });

    expect(result.stdout).toContain("Started");
  });
});
