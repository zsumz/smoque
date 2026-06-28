import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";

import {
  expect,
  getRegisteredSuites,
  resetSmokeRegistry,
  runRegisteredSuites,
  smoke,
} from "../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("registers suites with stable metadata", () => {
  smoke.suite("package smoke", { tags: ["package"] }, () => undefined);

  const suites = getRegisteredSuites();

  assert.equal(suites[0].id, "suite-1");
  assert.equal(suites[0].name, "package smoke");
  assert.deepEqual(suites[0].tags, ["package"]);
  assert.match(suites[0].file, /runner\.test\.ts$/u);
});

test("rejects duplicate suite names", () => {
  smoke.suite("duplicate", () => undefined);

  assert.throws(() => smoke.suite("duplicate", () => undefined), /Duplicate smoke suite name: duplicate/u);
});

test("runs registered suites, preserves step values, emits events, and cleans up in reverse", async () => {
  const events = [];
  const cleanupOrder = [];

  smoke.suite("happy path", async (t) => {
    assert.equal(t.repoRoot().toString(), "/tmp/smoque-fixture");

    const value = await t.step("return value", () => 42);
    assert.equal(value, 42);

    t.cleanup(() => cleanupOrder.push("first"));
    t.cleanup(() => cleanupOrder.push("second"));
  });

  const result = await runRegisteredSuites({
    runId: "test-run",
    repoRoot: "/tmp/smoque-fixture",
    eventSink: {
      emit(event) {
        events.push(event);
      },
    },
  });

  assert.equal(result.status, "passed");
  assert.equal(result.runId, "test-run");
  assert.equal(result.suites[0].status, "passed");
  assert.equal(result.suites[0].steps[0].status, "passed");
  assert.deepEqual(cleanupOrder, ["second", "first"]);
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "run.started",
      "suite.discovered",
      "suite.started",
      "step.started",
      "step.passed",
      "suite.finished",
      "run.finished",
    ],
  );
});

test("runs only selected suite ids", async () => {
  const events = [];
  const executed = [];

  smoke.suite("first suite", () => {
    executed.push("first");
  });
  smoke.suite("second suite", () => {
    executed.push("second");
  });

  const secondSuite = getRegisteredSuites().find((suite) => suite.name === "second suite");
  assert.ok(secondSuite);
  const result = await runRegisteredSuites({
    repoRoot: "/tmp/smoque-fixture",
    suiteIds: [secondSuite.id],
    eventSink: {
      emit(event) {
        events.push(event);
      },
    },
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(executed, ["second"]);
  assert.deepEqual(
    result.suites.map((suite) => suite.suite.name),
    ["second suite"],
  );
  assert.deepEqual(
    events.filter((event) => event.type === "suite.discovered").map((event) => event.name),
    ["second suite"],
  );
});

test("emits user log messages with suite and step context", async () => {
  const events = [];

  smoke.suite("logging suite", async (t) => {
    t.redact("secret");
    await t.log("suite secret");
    await t.step("logged step", async () => {
      await t.log("step secret");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: "/tmp/smoque-fixture",
    eventSink: {
      emit(event) {
        events.push(event);
      },
    },
  });
  const logs = events.filter((event) => event.type === "log.message");

  assert.equal(result.status, "passed");
  assert.deepEqual(
    logs.map((event) => ({ suiteId: event.suiteId, stepId: event.stepId, message: event.message })),
    [
      { suiteId: "suite-1", stepId: undefined, message: "suite [redacted]" },
      { suiteId: "suite-1", stepId: "suite-1:step-1", message: "step [redacted]" },
    ],
  );
});

test("preserves the primary failure when cleanup also fails", async () => {
  smoke.suite("failure path", async (t) => {
    t.cleanup(() => {
      throw new Error("cleanup failed");
    });

    await t.step("primary failure", () => {
      throw new Error("step failed");
    });
  });

  const result = await runRegisteredSuites({ repoRoot: "/tmp/smoque-fixture" });
  const suite = result.suites[0];

  assert.equal(result.status, "failed");
  assert.equal(suite.status, "failed");
  assert.equal(suite.error.message, "step failed");
  assert.equal(suite.cleanupErrors[0].message, "cleanup failed");
});

test("marks a suite skipped when t.skip is called", async () => {
  smoke.suite("skip me", (t) => {
    t.skip("not relevant here");
  });

  const result = await runRegisteredSuites({ repoRoot: "/tmp/smoque-fixture" });

  assert.equal(result.status, "passed");
  assert.equal(result.suites[0].status, "skipped");
  assert.equal(result.suites[0].steps.length, 0);
});

test("marks a step skipped when t.skip is called inside t.step", async () => {
  const events = [];

  smoke.suite("skip in step", async (t) => {
    await t.step("maybe skip", () => t.skip("nope"));
  });

  const result = await runRegisteredSuites({
    repoRoot: "/tmp/smoque-fixture",
    eventSink: {
      emit(event) {
        events.push(event);
      },
    },
  });
  const suite = result.suites[0];

  assert.equal(result.status, "passed");
  assert.equal(suite.status, "skipped");
  assert.equal(suite.error, undefined);
  assert.deepEqual(
    suite.steps.map((step) => ({ name: step.name, status: step.status, skipReason: step.skipReason })),
    [{ name: "maybe skip", status: "skipped", skipReason: "nope" }],
  );
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "run.started",
      "suite.discovered",
      "suite.started",
      "step.started",
      "step.skipped",
      "suite.finished",
      "run.finished",
    ],
  );
});

test("skip inside continueOnFailure step still skips the suite", async () => {
  let afterSkipRan = false;

  smoke.suite("skip beats continue", async (t) => {
    await t.step(
      "skip anyway",
      { continueOnFailure: true },
      () => t.skip("not today"),
    );

    afterSkipRan = true;
  });

  const result = await runRegisteredSuites({ repoRoot: "/tmp/smoque-fixture" });
  const suite = result.suites[0];

  assert.equal(result.status, "passed");
  assert.equal(suite.status, "skipped");
  assert.equal(afterSkipRan, false);
  assert.deepEqual(
    suite.steps.map((step) => ({ status: step.status, skipReason: step.skipReason })),
    [{ status: "skipped", skipReason: "not today" }],
  );
});

test("continueOnFailure records the step failure and keeps executing", async () => {
  smoke.suite("soft failure", async (t) => {
    await t.step(
      "allowed failure",
      { continueOnFailure: true },
      () => {
        throw new Error("soft failure");
      },
    );

    await t.step("after soft failure", () => undefined);
  });

  const result = await runRegisteredSuites({ repoRoot: "/tmp/smoque-fixture" });
  const suite = result.suites[0];

  assert.equal(result.status, "failed");
  assert.equal(suite.error.message, "soft failure");
  assert.deepEqual(
    suite.steps.map((step) => step.status),
    ["failed", "passed"],
  );
});

test("waits for async plugin registration before running", async () => {
  let registered = false;

  smoke.use({
    name: "@example/async-plugin",
    async register(registry) {
      await Promise.resolve();
      registry.action("example.action", () => undefined);
      registered = true;
    },
  });

  smoke.suite("uses plugin", () => undefined);

  await runRegisteredSuites({ repoRoot: "/tmp/smoque-fixture" });

  assert.equal(registered, true);
});

test("supports a tiny value expectation surface", () => {
  expect("hello smoke").toContain("smoke");
  expect("abc123").toMatch(/\d+/u);
  expect(1).toBe(1);
  expect({ ok: true }).toEqual({ ok: true });
  expect(true).toBeTruthy();
  expect(false).toBeFalsy();

  assert.throws(() => expect("hello").toContain("goodbye"), /Expected "hello" to contain "goodbye"/u);
});
