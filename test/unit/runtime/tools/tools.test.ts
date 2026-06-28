import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.tools discovers node and npm versions", async () => {
  smoke.suite("tool discovery", async (t) => {
    const node = await t.tools.node({ minVersion: 22 });
    assert.equal(node.command, process.execPath);
    assert.equal(node.path, process.execPath);
    assertVersionAtLeast(node.version, 22);

    const npm = await t.tools.npm({ minVersion: 10 });
    assert.equal(npm.command, "npm");
    assertVersionAtLeast(npm.version, 10);
    assert.ok(npm.path, "expected npm path to be reported");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("t.tools fails clearly when a version is too old", async () => {
  smoke.suite("tool version failure", async (t) => {
    await t.tools.node({ minVersion: "9999.0.0" });
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.equal(result.suites[0].error.name, "SmokeError");
  assert.match(result.suites[0].error.message, /Tool node version .* is below required 9999\.0\.0/u);
  assert.equal(result.suites[0].error.details.tool, "node");
});

function assertVersionAtLeast(version, minimumMajor) {
  const actual = version ?? "";
  assert.match(actual, /^\d+(?:\.\d+){0,2}$/u);
  const major = Number.parseInt(actual.split(".")[0], 10);
  assert.ok(
    major >= minimumMajor,
    `expected version ${actual} to have major >= ${minimumMajor}`,
  );
}
