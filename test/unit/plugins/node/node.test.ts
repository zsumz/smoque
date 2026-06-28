import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";
import nodePlugin from "../../../../dist/plugins/node.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.npm.pack creates a tarball and returns package metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-node-pack-"));
  const packageRoot = join(root, "package");
  const destination = join(root, "packed");
  let tarballPath;

  try {
    await mkdir(packageRoot, { recursive: true });
    await mkdir(destination, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(createPackageJson(), null, 2),
      "utf8",
    );
    await writeFile(join(packageRoot, "index.js"), "export const ok = true;\n", "utf8");

    smoke.use(nodePlugin());
    smoke.suite("pack fixture", async (t) => {
      const artifact = await t.npm.pack({ cwd: packageRoot, destination });

      assert.equal(artifact.filename, "smoque-pack-fixture-1.2.3.tgz");
      assert.equal(artifact.packageName, "smoque-pack-fixture");
      assert.equal(artifact.version, "1.2.3");
      assert.equal(artifact.path, join(destination, "smoque-pack-fixture-1.2.3.tgz"));
      tarballPath = artifact.path;
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    await access(tarballPath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.npm.fixture installs a packed tarball and runs inline Node", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-node-fixture-"));
  const packageRoot = join(root, "package");
  const destination = join(root, "packed");
  let fixturePath;

  try {
    await mkdir(packageRoot, { recursive: true });
    await mkdir(destination, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify(createPackageJson(), null, 2), "utf8");
    await writeFile(join(packageRoot, "index.js"), "export const ok = true;\n", "utf8");

    smoke.use(nodePlugin());
    smoke.suite("fixture install", async (t) => {
      const artifact = await t.npm.pack({ cwd: packageRoot, destination });
      const fixture = await t.npm.fixture({
        dir: join(root, "fixture"),
        packageJson: {
          private: true,
          type: "module",
          dependencies: {},
        },
      });

      fixturePath = fixture.path();
      await fixture.install(artifact.path, {
        scripts: "ignore",
        audit: false,
        fund: false,
        packageLock: false,
      });
      await fixture.node.inline(`
        import { ok } from "smoque-pack-fixture";
        if (ok !== true) {
          throw new Error("package import failed");
        }
      `);
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    await access(join(fixturePath, "node_modules", "smoque-pack-fixture", "index.js"));
    await assert.rejects(() => access(join(fixturePath, "package-lock.json")), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("npm fixture package assertions verify installed exports, bins, and types", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-node-package-surface-"));
  const packageRoot = join(root, "package");
  const destination = join(root, "packed");

  try {
    await mkdir(join(packageRoot, "dist", "cli"), { recursive: true });
    await mkdir(destination, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify(createSurfacePackageJson(), null, 2), "utf8");
    await writeFile(join(packageRoot, "dist", "index.js"), "export const ok = true;\n", "utf8");
    await writeFile(join(packageRoot, "dist", "index.d.ts"), "export declare const ok: true;\n", "utf8");
    await writeFile(join(packageRoot, "dist", "plugin.js"), "export const plugin = true;\n", "utf8");
    await writeFile(join(packageRoot, "dist", "plugin.d.ts"), "export declare const plugin: true;\n", "utf8");
    await writeFile(join(packageRoot, "dist", "cli", "main.js"), "#!/usr/bin/env node\nconsole.log('ok');\n", "utf8");

    smoke.use(nodePlugin());
    smoke.suite("fixture package surface", async (t) => {
      const artifact = await t.npm.pack({ cwd: packageRoot, destination });
      const fixture = await t.npm.fixture({
        dir: join(root, "fixture"),
        packageJson: {
          private: true,
          type: "module",
          dependencies: {},
        },
      });

      await fixture.install(artifact.path, {
        scripts: "ignore",
        audit: false,
        fund: false,
        packageLock: false,
      });

      const pkg = fixture.package("surface-fixture");
      await pkg.toExpose([".", "./plugin"]);
      await pkg.toExposeOnly([".", "./plugin"]);
      await pkg.toHaveBin("surface-fixture");
      await pkg.toHaveTypes([".", "./plugin"]);

      await assert.rejects(
        async () => {
          await pkg.toExpose("./missing");
        },
        (error) => {
          assert.match(error.message, /Expected package surface-fixture to expose subpaths: \.\/missing/u);
          assert.match(error.details.packageRoot, /node_modules\/surface-fixture$/u);
          assert.deepEqual(error.details.missingExports, ["./missing"]);
          return true;
        },
      );
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("npm fixture install ignores scripts by default and allows explicit opt in", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-node-install-policy-"));
  const packageRoot = join(root, "package");
  const destination = join(root, "packed");

  try {
    await mkdir(packageRoot, { recursive: true });
    await mkdir(destination, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify(createScriptPackageJson(), null, 2), "utf8");
    await writeFile(join(packageRoot, "index.js"), "export const ok = true;\n", "utf8");
    await writeFile(
      join(packageRoot, "postinstall.cjs"),
      "require('node:fs').writeFileSync('postinstall-ran.txt', 'yes');\n",
      "utf8",
    );

    smoke.use(nodePlugin());
    smoke.suite("install script policy", async (t) => {
      const artifact = await t.npm.pack({ cwd: packageRoot, destination });
      const ignored = await t.npm.fixture({ dir: join(root, "ignored-fixture") });

      await ignored.install(artifact.path, {
        audit: false,
        fund: false,
        packageLock: false,
      });

      await assert.rejects(
        () => access(ignored.path("node_modules", "script-fixture", "postinstall-ran.txt")),
        /ENOENT/u,
      );

      const allowed = await t.npm.fixture({ dir: join(root, "allowed-fixture") });
      await allowed.install(artifact.path, {
        scripts: "allow",
        audit: false,
        fund: false,
        packageLock: false,
      });

      await access(allowed.path("node_modules", "script-fixture", "postinstall-ran.txt"));
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function createPackageJson() {
  return {
    name: "smoque-pack-fixture",
    version: "1.2.3",
    type: "module",
    exports: "./index.js",
    files: ["index.js"],
  };
}

function createScriptPackageJson() {
  return {
    name: "script-fixture",
    version: "1.2.3",
    type: "module",
    scripts: {
      postinstall: "node postinstall.cjs",
    },
    exports: "./index.js",
    files: ["index.js", "postinstall.cjs"],
  };
}

function createSurfacePackageJson() {
  return {
    name: "surface-fixture",
    version: "1.2.3",
    type: "module",
    bin: {
      "surface-fixture": "./dist/cli/main.js",
    },
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
      "./plugin": {
        types: "./dist/plugin.d.ts",
        default: "./dist/plugin.js",
      },
    },
    types: "./dist/index.d.ts",
    files: ["dist"],
  };
}
