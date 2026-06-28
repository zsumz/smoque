import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { test } from "vitest";

import { expect, forbidden, resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../dist/core.js";

test("expect.value exposes the value matcher API", () => {
  expect("hello smoke").toContain("smoke");
  expect.value("hello smoke").toContain("smoke");
  expect.value(["package", "service"]).toContain("service");
  expect.value({ ok: true }).toEqual({ ok: true });

  assert.throws(
    () => expect.value("hello smoke").toContain("missing"),
    /Expected "hello smoke" to contain "missing"/u,
  );
});

test("expect.value uses deep equality for toEqual", () => {
  const shared = { ok: true };

  expect.value(shared).toBe(shared);
  expect.value({ alpha: 1, beta: 2 }).toEqual({ beta: 2, alpha: 1 });
  expect.value({ present: undefined }).toEqual({ present: undefined });
  expect.value(["cli", { nested: ["json"] }]).toEqual(["cli", { nested: ["json"] }]);
  expect.value({ service: { ports: [3000, 3001] } }).toEqual({ service: { ports: [3000, 3001] } });

  assert.throws(
    () => expect.value({ ok: true }).toBe({ ok: true }),
    /Expected \{ ok: true \} to be \{ ok: true \}/u,
  );
  assert.throws(
    () => expect.value({ nested: { ok: true } }).toEqual({ nested: { ok: false } }),
    /Expected \{ nested: \{ ok: true \} \} to equal \{ nested: \{ ok: false \} \}/u,
  );
  assert.throws(
    () => expect.value({ present: undefined }).toEqual({}),
    /Expected \{ present: undefined \} to equal \{\}/u,
  );
});

test("expect.file checks existence and content", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-file-"));
  const file = join(root, "dist", "index.js");

  try {
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(file, "export const ok = true;\n", "utf8");

    await expect.file(file).toExist();
    await expect.file(join(root, "missing.txt")).notToExist();
    await expect.file(file).toContain("export const ok");
    await expect.file(file).toContain(/ok\s*=\s*true/u);
    await expect.file(file).notToContain("process.env");

    await assert.rejects(() => expect.file(join(root, "missing.txt")).toExist(), /Expected file to exist/u);
    await assert.rejects(() => expect.file(file).notToExist(), /Expected file not to exist/u);
    await assert.rejects(() => expect.file(file).toContain("missing export"), /Expected file to contain/u);
    await assert.rejects(() => expect.file(file).notToContain("export const"), /Expected file not to contain/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.command and expect.file assert structured JSON paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-json-"));
  const config = join(root, "config.json");
  const command = {
    command: "demo-cli",
    args: ["config"],
    cwd: root,
    exitCode: 0,
    stdout: JSON.stringify({ ok: true, nested: { name: "demo", tags: ["cli", "json"] } }),
    stderr: JSON.stringify({ warning: { code: "soft" } }),
    durationMs: 1,
  };

  try {
    await writeFile(config, JSON.stringify({ service: { port: 4173, enabled: true } }), "utf8");

    await expect.command(command).stdoutJsonPath("$.ok").toBe(true);
    await expect.command(command).stdoutJsonPath("$.nested").toEqual({ name: "demo", tags: ["cli", "json"] });
    await expect.command(command).stdoutJsonPath("$.nested").toEqual({ tags: ["cli", "json"], name: "demo" });
    await expect.command(command).stderrJsonPath("$.warning.code").toBe("soft");
    await expect.file(config).jsonPath("$.service.port").toBe(4173);
    await expect.file(config).jsonPath("$.service.enabled").toExist();

    await assert.rejects(
      async () => {
        await expect.command({ ...command, stdout: "not json" }).stdoutJsonPath("$.ok").toExist();
      },
      (error) => {
        assert.match(error.message, /Expected valid JSON/u);
        assert.equal(error.details.source, "command");
        assert.equal(error.details.output, "stdout");
        assert.equal(error.details.command, "demo-cli");
        assert.equal(error.details.excerpt, "not json");
        return true;
      },
    );

    await assert.rejects(
      async () => {
        await expect.file(config).jsonPath("$.service.missing").toExist();
      },
      (error) => {
        assert.match(error.message, /Expected JSON path \$\.service\.missing to exist/u);
        assert.equal(error.details.source, "file");
        assert.equal(error.details.path, config);
        assert.equal(error.details.jsonPath, "$.service.missing");
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.file checks executables and checksums", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-executable-"));
  const script = join(root, "demo-cli.js");
  const source = "#!/usr/bin/env node\nconsole.log('demo-cli 1.2.3');\n";
  const checksum = createHash("sha256").update(source).digest("hex");

  try {
    await writeFile(script, source, "utf8");
    await chmod(script, 0o755);

    await expect.file(script).toBeExecutable({ args: ["--version"] });
    await expect.file(script).toHaveChecksum("sha256", checksum);

    await assert.rejects(
      async () => {
        await expect.file(script).toHaveChecksum("sha256", "0".repeat(64));
      },
      (error) => {
        assert.match(error.message, /Expected sha256 checksum to match/u);
        assert.equal(error.details.algorithm, "sha256");
        assert.equal(error.details.expected, "0".repeat(64));
        assert.equal(error.details.actual, checksum);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.file reports non-executable permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-not-executable-"));
  const script = join(root, "demo-cli.js");

  try {
    await writeFile(script, "#!/usr/bin/env node\n", "utf8");
    await chmod(script, 0o644);

    await assert.rejects(
      async () => {
        await expect.file(script).toBeExecutable({ args: ["--version"] });
      },
      (error) => {
        assert.match(error.message, /Expected file to be executable/u);
        assert.equal(error.details.permissions, "0644");
        assert.equal(error.details.platform, process.platform);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.files matches globs and finds expected content", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-files-"));

  try {
    await mkdir(join(root, "dist", "nested"), { recursive: true });
    await writeFile(join(root, "dist", "index.js"), "export const ok = true;\n", "utf8");
    await writeFile(join(root, "dist", "nested", "other.js"), "console.log('other');\n", "utf8");
    await writeFile(join(root, "dist", "style.css"), "body {}\n", "utf8");

    await expect.files(join(root, "dist")).matching("**/*.js").toContainAny(["other"]);

    await assert.rejects(
      () => expect.files(join(root, "dist")).matching("**/*.css").toContainAny(["other"]),
      /Expected at least one matched file/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.files.not.toContainAny reports the first offending file", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-files-not-"));

  try {
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "dist", "index.js"), "import fs from 'node:fs';\n", "utf8");

    await assert.rejects(
      async () => {
        await expect.files(join(root, "dist")).matching("**/*.js").not.toContainAny([/from\s+["']node:/u]);
      },
      (error) => {
        assert.match(error.message, /Expected files not to contain/u);
        assert.match(error.details.file, /index\.js$/u);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.files.not.toContainForbidden reports rule names and line numbers", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-forbidden-"));

  try {
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(
      join(root, "dist", "index.js"),
      [
        "export const ok = true;",
        "const token = 'npm_123456789012345678901234567890123456';",
        "",
      ].join("\n"),
      "utf8",
    );

    await assert.rejects(
      async () => {
        await expect.files(root).matching("**/*.js").not.toContainForbidden(forbidden.npmTokens());
      },
      (error) => {
        assert.match(error.message, /Forbidden content matched rule "npm token"/u);
        assert.match(error.message, /index\.js:2/u);
        assert.doesNotMatch(error.message, /npm_123456/u);
        assert.equal(error.details.rule, "npm token");
        assert.equal(error.details.line, 2);
        assert.match(error.details.file, /index\.js$/u);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.files.not.toContainForbidden reports forbidden file paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-forbidden-path-"));

  try {
    await mkdir(join(root, "fixture"), { recursive: true });
    await writeFile(join(root, "fixture", ".env"), "TOKEN=secret\n", "utf8");

    await assert.rejects(
      async () => {
        await expect.files(root).not.toContainForbidden(forbidden.envFiles());
      },
      (error) => {
        assert.match(error.message, /Forbidden file matched rule "env file"/u);
        assert.match(error.message, /fixture\/\.env/u);
        assert.equal(error.details.rule, "env file");
        assert.match(error.details.file, /\.env$/u);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expect.archive checks required and forbidden entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-archive-"));
  const archivePath = join(root, "package.tgz");

  try {
    await writeFile(
      archivePath,
      gzipSync(
        createTar([
          ["./package/index.js", "export const ok = true;\n"],
          ["./package/README.md", "# package\n"],
        ]),
      ),
    );

    await expect.archive(archivePath).toContainEntries(["package/index.js", "package/README.md"]);
    await expect.archive(archivePath).not.toContainEntries(["package/.env", "package/private.key"]);

    await assert.rejects(
      async () => {
        await expect.archive(archivePath).toContainEntries(["package/missing.js"]);
      },
      (error) => {
        assert.match(error.message, /Expected archive to contain entries/u);
        assert.deepEqual(error.details.missing, ["package/missing.js"]);
        assert.deepEqual(error.details.entries, ["package/README.md", "package/index.js"]);
        return true;
      },
    );

    await assert.rejects(
      async () => {
        await expect.archive(archivePath).not.toContainEntries(["package/index.js"]);
      },
      (error) => {
        assert.match(error.message, /Expected archive not to contain entries/u);
        assert.deepEqual(error.details.forbidden, ["package/index.js"]);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("text snapshots update and report diffs", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-text-snapshot-"));
  const snapshotPath = join(root, "__snapshots__", "cli-output.txt");

  try {
    smoke.suite("write text snapshot", async () => {
      await expect.text("alpha\nbeta\n").toMatchSnapshot(snapshotPath);
    });

    let result = await runRegisteredSuites({ repoRoot: root, updateSnapshots: true });
    assert.equal(result.status, "passed");
    assert.equal(await readFile(snapshotPath, "utf8"), "alpha\nbeta\n");

    resetSmokeRegistry();
    smoke.suite("match text snapshot", async () => {
      await expect.text("alpha\nchanged\n").toMatchSnapshot(snapshotPath);
    });

    result = await runRegisteredSuites({ repoRoot: root });
    assert.equal(result.status, "failed");
    assert.match(result.suites[0].error.message, /Text snapshot did not match/u);
    assert.match(result.suites[0].error.details.diff, /- 2: beta/u);
    assert.match(result.suites[0].error.details.diff, /\+ 2: changed/u);
  } finally {
    resetSmokeRegistry();
    await rm(root, { recursive: true, force: true });
  }
});

test("directory snapshots update and report added removed and changed entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-expect-dir-snapshot-"));
  const outputDir = join(root, "generated");
  const snapshotPath = join(root, "__snapshots__", "generated.json");

  try {
    await mkdir(join(outputDir, "assets"), { recursive: true });
    await writeFile(join(outputDir, "index.html"), "<h1>Hello</h1>\n", "utf8");
    await writeFile(join(outputDir, "assets", "app.js"), "console.log('hello');\n", "utf8");

    smoke.suite("write directory snapshot", async () => {
      await expect.directory(outputDir).toMatchSnapshot(snapshotPath, { checksum: "sha256" });
    });

    let result = await runRegisteredSuites({ repoRoot: root, updateSnapshots: true });
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));

    assert.equal(result.status, "passed");
    assert.equal(snapshot.schemaVersion, "smoque.directory-snapshot.v1");
    assert.deepEqual(
      snapshot.entries.map((entry) => entry.path),
      ["assets", "assets/app.js", "index.html"],
    );
    assert.equal(snapshot.entries.find((entry) => entry.path === "index.html").checksum.algorithm, "sha256");

    await rm(join(outputDir, "assets", "app.js"));
    await writeFile(join(outputDir, "index.html"), "<h1>Changed</h1>\n", "utf8");
    await writeFile(join(outputDir, "extra.txt"), "extra\n", "utf8");

    resetSmokeRegistry();
    smoke.suite("match directory snapshot", async () => {
      await expect.directory(outputDir).toMatchSnapshot(snapshotPath, { checksum: "sha256" });
    });

    result = await runRegisteredSuites({ repoRoot: root });
    assert.equal(result.status, "failed");
    assert.match(result.suites[0].error.message, /Directory snapshot did not match/u);
    assert.deepEqual(result.suites[0].error.details.added.map((entry) => entry.path), ["extra.txt"]);
    assert.deepEqual(result.suites[0].error.details.removed.map((entry) => entry.path), ["assets/app.js"]);
    assert.deepEqual(result.suites[0].error.details.changed.map((entry) => entry.path), ["index.html"]);
  } finally {
    resetSmokeRegistry();
    await rm(root, { recursive: true, force: true });
  }
});

function createTar(entries) {
  const chunks = [];

  for (const [name, content] of entries) {
    const body = Buffer.from(content, "utf8");
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write("0000644\0", 100, 8, "ascii");
    header.write("0000000\0", 108, 8, "ascii");
    header.write("0000000\0", 116, 8, "ascii");
    header.write(body.byteLength.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0", 136, 12, "ascii");
    header.fill(0x20, 148, 156);
    header.write("0", 156, 1, "ascii");
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");

    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");

    chunks.push(header, body, Buffer.alloc((512 - (body.byteLength % 512)) % 512));
  }

  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}
