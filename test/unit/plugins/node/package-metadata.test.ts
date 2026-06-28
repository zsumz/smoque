import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";

import { getBinTarget } from "../../../../dist/plugins/node/bin.js";
import {
  getExportEntry,
  getTypesPath,
  listExportedSubpaths,
  normalizeSubpaths,
} from "../../../../dist/plugins/node/exports.js";
import { createNpmPackageExpectation } from "../../../../dist/plugins/node/package-expectation.js";
import { readInstalledPackage } from "../../../../dist/plugins/node/package-json.js";

test("package export helpers normalize subpaths and list export shapes", () => {
  assert.deepEqual(normalizeSubpaths([".", " plugin ", "./already", ""]), [
    ".",
    "./plugin",
    "./already",
    ".",
  ]);

  assert.equal(getExportEntry({ exports: "./dist/index.js" }, "."), "./dist/index.js");
  assert.deepEqual(listExportedSubpaths({ exports: "./dist/index.js" }), ["."]);

  const conditionalRoot = {
    exports: {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
      require: "./dist/index.cjs",
    },
  };

  assert.deepEqual(getExportEntry(conditionalRoot, "."), conditionalRoot.exports);
  assert.deepEqual(listExportedSubpaths(conditionalRoot), ["."]);

  const subpaths = {
    exports: {
      "./plugin": "./dist/plugin.js",
      ".": "./dist/index.js",
      "./cli": "./dist/cli.js",
    },
  };

  assert.deepEqual(listExportedSubpaths(subpaths), [".", "./cli", "./plugin"]);
  assert.equal(getExportEntry(subpaths, "./missing"), undefined);
  assert.deepEqual(listExportedSubpaths({ exports: 42 }), []);
});

test("package export helpers find type declarations in nested conditions", () => {
  assert.equal(getTypesPath({ exports: "./dist/index.d.ts" }, "."), "./dist/index.d.ts");
  assert.equal(getTypesPath({ exports: "./dist/index.js", types: "./dist/index.d.ts" }, "."), "./dist/index.d.ts");
  assert.equal(getTypesPath({ exports: "./dist/index.js", typings: "./dist/index.d.ts" }, "."), "./dist/index.d.ts");

  const packageJson = {
    exports: {
      ".": [
        "./dist/index.js",
        {
          import: {
            types: "./dist/index.d.mts",
            default: "./dist/index.mjs",
          },
        },
      ],
      "./plugin": {
        node: {
          typings: "./dist/plugin.d.cts",
          default: "./dist/plugin.cjs",
        },
      },
      "./missing": {
        import: "./dist/missing.js",
      },
    },
  };

  assert.equal(getTypesPath(packageJson, "."), "./dist/index.d.mts");
  assert.equal(getTypesPath(packageJson, "./plugin"), "./dist/plugin.d.cts");
  assert.equal(getTypesPath(packageJson, "./missing"), undefined);
});

test("package bin helper supports string bins for scoped package basenames", () => {
  assert.equal(getBinTarget({ bin: "./bin/tool.js" }, "@scope/tool", "@scope/tool"), "./bin/tool.js");
  assert.equal(getBinTarget({ bin: "./bin/tool.js" }, "@scope/tool", "tool"), "./bin/tool.js");
  assert.equal(getBinTarget({ bin: "./bin/tool.js" }, "@scope/tool", "other"), undefined);
  assert.equal(getBinTarget({ bin: { tool: "./bin/tool.js" } }, "@scope/tool", "tool"), "./bin/tool.js");
  assert.equal(getBinTarget({ bin: { tool: 42 } }, "@scope/tool", "tool"), undefined);
});

test("readInstalledPackage reports missing and malformed package metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-package-metadata-"));

  try {
    await assert.rejects(
      () => readInstalledPackage(join(root, "missing"), "missing-package"),
      (error) => {
        assert.match(error.message, /Expected installed package to exist: missing-package/u);
        assert.equal(error.details.packageName, "missing-package");
        assert.equal(error.details.path, join(root, "missing", "package.json"));
        return true;
      },
    );

    const invalidRoot = join(root, "invalid");
    await mkdir(invalidRoot, { recursive: true });
    await writeFile(join(invalidRoot, "package.json"), "{ nope", "utf8");

    await assert.rejects(
      () => readInstalledPackage(invalidRoot, "invalid-package"),
      (error) => {
        assert.match(error.message, /Installed package has invalid package\.json: invalid-package/u);
        assert.equal(error.details.packageRoot, invalidRoot);
        return true;
      },
    );

    const nonObjectRoot = join(root, "non-object");
    await mkdir(nonObjectRoot, { recursive: true });
    await writeFile(join(nonObjectRoot, "package.json"), "null", "utf8");

    await assert.rejects(
      () => readInstalledPackage(nonObjectRoot, "non-object-package"),
      (error) => {
        assert.match(error.message, /Installed package package\.json must be an object: non-object-package/u);
        assert.equal(error.details.path, join(nonObjectRoot, "package.json"));
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("npm package expectations report missing exports, types, and bins", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-package-expectation-"));

  try {
    await writeInstalledPackage(root, "surface-package", {
      name: "surface-package",
      version: "1.0.0",
      exports: {
        ".": "./dist/index.js",
        "./extra": "./dist/extra.js",
        "./typed": {
          types: "./dist/typed.d.ts",
          default: "./dist/typed.js",
        },
      },
      bin: {
        "surface-package": "./dist/cli.js",
      },
    });

    const pkg = createNpmPackageExpectation(root, "surface-package");

    await assert.rejects(
      () => pkg.toExposeOnly([".", "./missing"]),
      (error) => {
        assert.match(error.message, /Expected package surface-package exports to match exactly\./u);
        assert.deepEqual(error.details.missingExports, ["./missing"]);
        assert.deepEqual(error.details.unexpectedExports, ["./extra", "./typed"]);
        return true;
      },
    );

    await assert.rejects(
      () => pkg.toHaveTypes("."),
      (error) => {
        assert.match(error.message, /Expected package surface-package to declare types for subpaths: \./u);
        assert.deepEqual(error.details.missingTypes, ["."]);
        assert.equal(error.details.exports["./typed"].types, "./dist/typed.d.ts");
        return true;
      },
    );

    await assert.rejects(
      () => pkg.toHaveTypes("./typed"),
      (error) => {
        assert.match(error.message, /Expected package surface-package type declaration to exist for \.\/typed/u);
        assert.equal(error.details.subpath, "./typed");
        assert.equal(error.details.types, "./dist/typed.d.ts");
        assert.match(error.details.path, /node_modules\/surface-package\/dist\/typed\.d\.ts$/u);
        return true;
      },
    );

    await assert.rejects(
      () => pkg.toHaveBin("surface-package"),
      (error) => {
        assert.match(error.message, /Expected package bin target to exist: surface-package/u);
        assert.equal(error.details.binTarget, "./dist/cli.js");
        return true;
      },
    );

    await mkdir(join(root, "node_modules", "surface-package", "dist"), { recursive: true });
    await writeFile(join(root, "node_modules", "surface-package", "dist", "cli.js"), "#!/usr/bin/env node\n", "utf8");

    await assert.rejects(
      () => pkg.toHaveBin("surface-package"),
      (error) => {
        assert.match(error.message, /Expected installed package bin to exist: surface-package/u);
        assert.match(error.details.path, /node_modules\/\.bin\/surface-package$/u);
        return true;
      },
    );

    await assert.rejects(
      () => pkg.toHaveBin("missing-bin"),
      (error) => {
        assert.match(error.message, /Expected package surface-package to declare bin: missing-bin/u);
        assert.equal(error.details.binName, "missing-bin");
        assert.deepEqual(error.details.bin, { "surface-package": "./dist/cli.js" });
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeInstalledPackage(root, packageName, packageJson) {
  const packageRoot = join(root, "node_modules", packageName);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(join(packageRoot, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");
  return packageRoot;
}
