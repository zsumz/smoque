import assert from "node:assert/strict";

import { expect, forbidden, smoke } from "smoque";

const expectedEntries = [
  "package/dist/index.js",
  "package/dist/core.js",
  "package/dist/plugin.js",
  "package/dist/cli/main.js",
  "package/dist/plugins/node.js",
  "package/dist/plugins/http.js",
  "package/dist/plugins/archive.js",
  "package/package.json",
];

smoke.suite("smoque package publishes public runtime files only", { tags: ["package"] }, async (t) => {
  const root = t.repoRoot();
  const work = await t.tempDir("package-contents");

  await t.step("build package", async () => {
    await t.cmd("npm", ["run", "build"], { cwd: root });
  });

  await t.step("tarball has clean contents", async () => {
    const destination = work.path("smoque");
    await t.fs.mkdir(destination);

    const tarball = await t.npm.pack({
      cwd: root,
      destination,
    });

    await expect.archive(tarball.path).toContainEntries(expectedEntries);
    await expect
      .archive(tarball.path)
      .not.toContainEntries([
        "package/dist/plugins/java.js",
        "package/dist/plugins/java.d.ts",
      ]);
    await expect
      .files(root)
      .matching(["package.json", "dist/**/*.js", "dist/**/*.d.ts"])
      .not.toContainForbidden([
        forbidden.privateKeys(),
        forbidden.npmTokens(),
        forbidden.envFiles(),
        forbidden.internalFiles(),
      ]);

    const entries = await t.archive.list(tarball.path);
    assert.equal(
      entries.some((entry) => entry.endsWith(".map")),
      false,
      "smoque tarball should not include source maps",
    );
    assert.equal(
      entries.some(
        (entry) => entry.startsWith("package/src/") || entry.startsWith("package/test/"),
      ),
      false,
      "smoque tarball should not include source or test files",
    );
  });
});