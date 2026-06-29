import { expect, smoke } from "smoque";

smoke.suite("CLI fixture from template", async (t) => {
  const project = await t.fixture.fromTemplate(t.repoRoot().path("examples", "templates", "demo-cli"), {
    tokens: {
      name: "demo-cli",
      bin: "demo",
    },
  });

  await t.step("generated CLI runs", async () => {
    await t.cmd(process.execPath, [project.path("bin", "cli.js"), "--name", "smoque"]);
  });
});

smoke.suite("non-node fixture from template", async (t) => {
  const project = await t.fixture.fromTemplate(t.repoRoot().path("examples", "templates", "plain-service"), {
    tokens: {
      serviceName: "billing",
      port: 9080,
    },
  });

  await t.step("generated config has expected values", async () => {
    await expect.file(project.path("config", "service.conf")).toContain("name=billing");
    await expect.file(project.path("config", "service.conf")).toContain("port=9080");
  });
});
