import assert from "node:assert/strict";
import { test } from "vitest";

import { runRegisteredSuites, smoke } from "../../../dist/index.js";

test("smoque exposes MVP standard plugin context", async () => {
  smoke.suite("standard plugins", (t) => {
    assert.equal(typeof t.npm.pack, "function");
    assert.equal(typeof t.npm.fixture, "function");
    assert.equal(typeof t.http.get, "function");
    assert.equal(typeof t.http.fakeServer, "function");
    assert.equal(typeof t.tcp.ready, "function");
    assert.equal(typeof t.fs.ready, "function");
    assert.equal(typeof t.archive.list, "function");
    assert.equal(typeof t.compose.check, "function");
    assert.equal(typeof t.compose.up, "function");
    assert.equal(typeof t.postgres.check, "function");
    assert.equal(typeof t.postgres.connect, "function");
    assert.equal(typeof t.postgres.start, "function");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});
