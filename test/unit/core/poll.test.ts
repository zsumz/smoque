import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../dist/core.js";
import { poll } from "../../../dist/poll.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.poll retries until the callback succeeds", async () => {
  let attempts = 0;

  smoke.suite("poll success", async (t) => {
    const value = await t.poll(
      "eventual value",
      () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error(`not yet ${attempts}`);
        }
        return "ready";
      },
      { timeout: "200ms", interval: "5ms" },
    );

    assert.equal(value, "ready");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.equal(attempts, 3);
});

test("t.poll treats false as not ready", async () => {
  let attempts = 0;

  smoke.suite("poll false", async (t) => {
    const value = await t.poll(
      "eventual boolean",
      () => {
        attempts += 1;
        return attempts >= 2;
      },
      { timeout: "200ms", interval: "5ms" },
    );

    assert.equal(value, true);
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.equal(attempts, 2);
});

test("t.poll reports timeout details with the last observed failure", async () => {
  smoke.suite("poll timeout", async (t) => {
    await t.poll(
      "never ready",
      () => {
        throw new Error("still closed");
      },
      { timeout: "30ms", interval: "5ms" },
    );
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });
  const error = result.suites[0].error;

  assert.equal(result.status, "failed");
  assert.equal(error.name, "ProbeTimeoutError");
  assert.equal(error.details.name, "never ready");
  assert.equal(error.details.timeoutMs, 30);
  assert.equal(error.details.lastError.message, "still closed");
});

test("poll serializes non-Error timeout failures", async () => {
  const scenarios = [
    {
      value: "not open",
      expected: "not open",
    },
    {
      value: 503,
      expected: "503",
    },
    {
      value: { status: "warming" },
      expected: '{"status":"warming"}',
    },
  ];

  for (const scenario of scenarios) {
    await assert.rejects(
      () =>
        poll(
          "service",
          () => {
            throw scenario.value;
          },
          { timeout: "1ms", interval: "1ms" },
        ),
      (error) => {
        assert.equal(error.name, "ProbeTimeoutError");
        assert.equal(error.details.lastError.message, scenario.expected);
        return true;
      },
    );
  }
});
