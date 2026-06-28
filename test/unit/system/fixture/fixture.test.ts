import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.fixture.fromTemplate copies templates with token replacement and managed cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-fixture-template-"));
  const template = join(root, "template");
  let copiedPath;

  try {
    await mkdir(join(template, "bin"), { recursive: true });
    await writeFile(join(template, "package.json"), '{ "name": "{{name}}", "port": {{port}} }\n', "utf8");
    await writeFile(join(template, "bin", "cli.js"), "#!/usr/bin/env node\nconsole.log('{{name}}');\n", "utf8");
    await chmod(join(template, "bin", "cli.js"), 0o755);

    smoke.suite("template fixture", async (t) => {
      const fixture = await t.fixture.fromTemplate(template, {
        tokens: {
          name: "demo-cli",
          port: 4173,
        },
      });

      copiedPath = fixture.toString();
      assert.equal(await t.fs.readText(fixture.path("package.json")), '{ "name": "demo-cli", "port": 4173 }\n');
      assert.equal(await t.fs.readText(fixture.path("bin", "cli.js")), "#!/usr/bin/env node\nconsole.log('demo-cli');\n");
      assert.equal((await stat(fixture.path("bin", "cli.js"))).mode & 0o111, 0o111);
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    await assert.rejects(() => access(copiedPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.fixture.fromTemplate copies into provided work dirs and reports missing templates", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-fixture-template-workdir-"));
  const template = join(root, "template");

  try {
    await mkdir(template, { recursive: true });
    await writeFile(join(template, "README.md"), "# {{title}}\n", "utf8");

    smoke.suite("workdir template fixture", async (t) => {
      const work = await t.workDir(".smoque/template-fixture", { clean: true });
      const fixture = await t.fixture.fromTemplate(template, {
        dir: work,
        tokens: { title: "Generated Project" },
      });

      assert.equal(await t.fs.readText(fixture.path("README.md")), "# Generated Project\n");
    });

    let result = await runRegisteredSuites({ repoRoot: root });
    assert.equal(result.status, "passed");
    await assert.rejects(() => access(join(root, ".smoque", "template-fixture")), /ENOENT/u);

    resetSmokeRegistry();
    smoke.suite("missing template", async (t) => {
      await t.fixture.fromTemplate(join(root, "missing-template"), {
        dir: join(root, "copy"),
      });
    });

    result = await runRegisteredSuites({ repoRoot: root });
    assert.equal(result.status, "failed");
    assert.match(result.suites[0].error.message, /Fixture template directory not found/u);
    assert.equal(result.suites[0].error.details.template, join(root, "missing-template"));
    assert.equal(result.suites[0].error.details.destination, join(root, "copy"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.fixture.fromTemplate resolves string paths relative to repoRoot", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-fixture-template-context-"));

  try {
    await mkdir(join(root, "templates", "app"), { recursive: true });
    await writeFile(join(root, "templates", "app", "README.md"), "# {{title}}\n", "utf8");

    smoke.suite("relative template fixture", async (t) => {
      const fixture = await t.fixture.fromTemplate("templates/app", {
        dir: "generated/app",
        tokens: { title: "Context Root" },
      });

      assert.equal(fixture.toString(), join(root, "generated", "app"));
      assert.equal(await t.fs.readText("generated/app/README.md"), "# Context Root\n");
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    await access(join(root, "generated", "app", "README.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
