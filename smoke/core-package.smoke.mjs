import { expect, smoke } from "smoque";

smoke.suite("smoque package can be packed and imported", { tags: ["package"] }, async (t) => {
  const root = t.repoRoot();
  const work = await t.tempDir("smoque-package");
  const packed = work.path("packed");
  const fixtureDir = work.path("fixture");

  await t.step("required tools are available", async () => {
    await t.tools.node({ minVersion: 22 });
    await t.tools.npm({ minVersion: 10 });
  });

  await t.step("build smoque package", async () => {
    await t.cmd("npm", ["run", "build"], { cwd: root });
  });

  await t.step("prepare pack destination", async () => {
    await t.fs.mkdir(packed);
  });

  const tarball = await t.step("pack smoque package artifact", async () => {
    return await t.npm.pack({
      cwd: root,
      destination: packed,
    });
  });

  await t.step("tarball contains public runtime files", async () => {
    await expect
      .archive(tarball.path)
      .toContainEntries([
        "package/dist/index.js",
        "package/dist/core.js",
        "package/dist/plugin.js",
        "package/dist/cli/main.js",
        "package/dist/plugins/node.js",
        "package/dist/plugins/http.js",
        "package/dist/plugins/archive.js",
        "package/package.json",
      ]);
  });

  await t.step("tarball excludes local-only files", async () => {
    await expect
      .archive(tarball.path)
      .not.toContainEntries([
        "package/.env",
        "package/.npmrc",
        "package/private.key",
        "package/src/core.ts",
        "package/dist/plugins/java.js",
        "package/dist/plugins/java.d.ts",
        "package/test/runner.test.ts",
      ]);
  });

  const fixture = await t.step("create clean npm fixture", async () => {
    return await t.npm.fixture({
      dir: fixtureDir,
      packageJson: {
        private: true,
        type: "module",
        dependencies: {},
      },
    });
  });

  await t.step("install packed smoque package", async () => {
    await fixture.install(tarball.path, {
      scripts: "ignore",
      audit: false,
      fund: false,
      packageLock: false,
    });
  });

  await t.step("installed smoque package exposes public surface", async () => {
    const pkg = fixture.package("smoque");
    await pkg.toExposeOnly([".", "./plugin"]);
    await pkg.toHaveBin("smoque");
    await pkg.toHaveTypes([".", "./plugin"]);
  });

  await t.step("installed smoque package imports", async () => {
    await fixture.node.inline(`
      import * as smoque from "smoque";
      import { runRegisteredSuites, smoke } from "smoque";

      for (const name of ["expect", "forbidden", "listArchiveEntries", "runRegisteredSuites", "smoke"]) {
        if (!(name in smoque)) {
          throw new Error("missing public export: " + name);
        }
      }
      for (const name of ["resetSmokeRegistry", "definePlugin"]) {
        if (name in smoque) {
          throw new Error("unexpected root export: " + name);
        }
      }
      smoke.suite("installed package smoke", async (t) => {
        await t.step("basic step", () => undefined);
      });

      const result = await runRegisteredSuites({ repoRoot: process.cwd() });
      if (result.status !== "passed") {
        throw new Error("installed package smoke failed");
      }
    `);
  });
});