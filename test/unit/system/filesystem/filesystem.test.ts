import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.tempDir creates a path ref and cleans up after success", async () => {
  let tempPath;

  smoke.suite("temp dir", async (t) => {
    const temp = await t.tempDir("basic");
    tempPath = temp.toString();

    await t.fs.writeText(temp.path("nested", "note.txt"), "hello");

    assert.equal(await t.fs.exists(temp.path("nested", "note.txt")), true);
    assert.equal(await t.fs.exists(temp.path("nested")), true);
    assert.equal(await t.fs.exists(temp.path("missing.txt")), false);
    assert.deepEqual(await t.fs.ready(temp.path("nested")).check(), {
      ready: true,
      message: temp.path("nested"),
    });
    assert.equal(await t.fs.readText(temp.path("nested", "note.txt")), "hello");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  await assert.rejects(() => access(tempPath), /ENOENT/u);
});

test("t.tempDir preserves files on failure when configured", async () => {
  let tempPath;

  smoke.suite("preserved temp dir", async (t) => {
    const temp = await t.tempDir("preserve");
    tempPath = temp.toString();

    await t.fs.writeText(temp.path("debug.log"), "kept");

    await t.step("fail", () => {
      throw new Error("boom");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    keepWorkdirOnFail: true,
  });

  try {
    assert.equal(result.status, "failed");
    assert.equal(await readFile(join(tempPath, "debug.log"), "utf8"), "kept");
  } finally {
    await rm(tempPath, { recursive: true, force: true });
  }
});

test("t.fs.rm refuses to remove the repo root", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "smoque-repo-root-"));

  smoke.suite("safe rm", async (t) => {
    await assert.rejects(() => t.fs.rm(t.repoRoot(), { recursive: true, force: true }), /Refusing to remove unsafe path/u);
    await assert.rejects(() => t.fs.rm(dirname(repoRoot), { recursive: true, force: true }), /Refusing to remove unsafe path/u);
    await assert.rejects(() => t.fs.rm(parse(repoRoot).root, { recursive: true, force: true }), /Refusing to remove unsafe path/u);
    await assert.rejects(() => t.fs.rm(homedir(), { recursive: true, force: true }), /Refusing to remove unsafe path/u);

    await t.fs.mkdir("keep");
    await assert.rejects(() => t.fs.rm("keep", { recursive: true, force: true, refuse: ["keep"] }), /Refusing to remove unsafe path/u);
  });

  try {
    const result = await runRegisteredSuites({ repoRoot });

    assert.equal(result.status, "passed");
    await access(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("t.fs resolves string paths relative to repoRoot", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "smoque-fs-context-root-"));
  const relativeDir = `.smoque-context-${process.pid}`;

  try {
    await writeFile(join(repoRoot, "package.json"), "repo-root package\n", "utf8");

    smoke.suite("context filesystem", async (t) => {
      assert.equal(await t.fs.readText("package.json"), "repo-root package\n");

      await t.fs.mkdir(relativeDir);
      await t.fs.writeText(`${relativeDir}/note.txt`, "hello");
      await t.fs.copy(`${relativeDir}/note.txt`, `${relativeDir}/copy.txt`);

      assert.equal(await t.fs.exists(relativeDir), true);
      assert.equal(await t.fs.readText(`${relativeDir}/copy.txt`), "hello");
      assert.deepEqual(await t.fs.ready(`${relativeDir}/copy.txt`).check(), {
        ready: true,
        message: join(repoRoot, relativeDir, "copy.txt"),
      });

      await t.fs.rm(`${relativeDir}/copy.txt`);
      assert.equal(await t.fs.exists(`${relativeDir}/copy.txt`), false);
    });

    const result = await runRegisteredSuites({ repoRoot });

    assert.equal(result.status, "passed");
    assert.equal(await readFile(join(repoRoot, relativeDir, "note.txt"), "utf8"), "hello");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(join(process.cwd(), relativeDir), { recursive: true, force: true });
  }
});

test("t.workDir cleans stale content, returns a repo-local path, and cleans up after success", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "smoque-workdir-root-"));
  const stalePath = join(repoRoot, "target", "smoke", "old.txt");
  let workPath;

  await mkdir(join(repoRoot, "target", "smoke"), { recursive: true });
  await writeFile(stalePath, "stale", "utf8");

  smoke.suite("work dir", async (t) => {
    const work = await t.workDir("target/smoke", { clean: true });
    workPath = work.toString();

    assert.equal(work.path("new.txt"), join(repoRoot, "target", "smoke", "new.txt"));
    assert.equal(await t.fs.exists(work.path("old.txt")), false);

    await t.fs.writeJson(work.path("new.json"), { ok: true });
    assert.equal(await t.fs.readText(work.path("new.json")), '{\n  "ok": true\n}\n');
  });

  try {
    const result = await runRegisteredSuites({ repoRoot });

    assert.equal(result.status, "passed");
    await assert.rejects(() => access(workPath), /ENOENT/u);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
