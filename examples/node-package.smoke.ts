import { smoke, expect } from "smoque";

smoke.suite("node package publishes cleanly", async (t) => {
  const root = t.repoRoot();
  const work = await t.tempDir("node-package-smoke");

  await t.step("build package", async () => {
    await t.cmd("npm", ["run", "build"], { cwd: root });
  });

  const tarball = await t.step("pack package", async () => {
    return await t.npm.pack({ cwd: root, destination: work.path() });
  });

  await t.step("packed artifact excludes private files", async () => {
    await expect.archive(tarball.path).not.toContainEntries([
      "package/.env",
      "package/.npmrc",
      "package/private.key",
      "package/scripts/local-only.mjs",
    ]);
  });

  const fixture = await t.step("create clean fixture", async () => {
    return await t.npm.fixture({
      dir: work.path("fixture"),
      packageJson: {
        private: true,
        type: "module",
        dependencies: {},
      },
    });
  });

  await t.step("install packed artifact", async () => {
    await fixture.install(tarball.path, {
      scripts: "ignore",
      audit: false,
      fund: false,
      packageLock: false,
    });
  });

  await t.step("public API imports", async () => {
    await fixture.node.inline(`
      import { createClient } from "my-package";
      if (typeof createClient !== "function") {
        throw new Error("expected createClient export");
      }
    `);
  });

  await t.step("browser build has no Node runtime usage", async () => {
    await expect.files(fixture.path("node_modules/my-package/dist"))
      .matching("**/*.js")
      .not.toContainAny([
        /from\s+["']node:/u,
        /import\s*\(\s*["']node:/u,
        /require\s*\(\s*["']node:/u,
        /\bprocess\./u,
        /\bBuffer\./u,
      ]);
  });
});
