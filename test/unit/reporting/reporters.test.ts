import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import {
  createGitHubReporter,
  createJsonReporter,
  createJUnitReporter,
  createTerminalReporter,
  resetSmokeRegistry,
  runRegisteredSuites,
  smoke,
} from "../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("createJsonReporter summarizes suites, steps, commands, artifacts, and events", async () => {
  let output = "";
  const reporter = createJsonReporter({
    includeEvents: true,
    write(text) {
      output = text;
    },
  });

  smoke.suite("json report smoke", async (t) => {
    await t.step("run command", async () => {
      const result = await t.cmd(process.execPath, [
        "-e",
        "console.log('hello'); console.error('warn');",
      ]);
      assert.equal(result.exitCode, 0);
      await t.attach.text("inline-note", "attached");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });
  const report = reporter.report();

  assert.equal(result.status, "passed");
  assert.equal(report.schemaVersion, "smoque.report.v1");
  assert.equal(report.run.status, "passed");
  assert.equal(report.suites[0].name, "json report smoke");
  assert.equal(report.suites[0].status, "passed");
  assert.equal(report.suites[0].steps[0].name, "run command");
  assert.equal(report.suites[0].steps[0].commands[0].stdout, "hello\n");
  assert.equal(report.suites[0].steps[0].commands[0].stderr, "warn\n");
  assert.equal(report.suites[0].steps[0].artifacts[0].name, "inline-note");
  assert.equal(report.suites[0].steps[0].artifacts[0].kind, "text");
  assert.match(report.suites[0].steps[0].artifacts[0].path, /inline-note/u);
  assert.equal(await readFile(report.suites[0].steps[0].artifacts[0].path, "utf8"), "attached");
  assert.ok(report.events.some((event) => event.type === "run.finished"));
  assert.deepEqual(JSON.parse(output), report);
});

test("createJsonReporter writes a JSON report file", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-json-reporter-"));
  const reportPath = join(root, "smoke-report.json");

  try {
    smoke.suite("json file report", () => undefined);

    const reporter = createJsonReporter({ path: reportPath, pretty: false });
    const result = await runRegisteredSuites({
      repoRoot: root,
      eventSink: reporter,
    });
    const report = JSON.parse(await readFile(reportPath, "utf8"));

    assert.equal(result.status, "passed");
    assert.equal(report.schemaVersion, "smoque.report.v1");
    assert.equal(report.suites[0].name, "json file report");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createJsonReporter records skipped steps", async () => {
  const reporter = createJsonReporter({ write() {} });

  smoke.suite("json skip report", async (t) => {
    await t.step("skip branch", () => t.skip("not on this platform"));
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });
  const report = reporter.report();

  assert.equal(result.status, "passed");
  assert.equal(report.run.status, "passed");
  assert.equal(report.suites[0].status, "skipped");
  assert.equal(report.suites[0].steps[0].status, "skipped");
  assert.equal(report.suites[0].steps[0].skipReason, "not on this platform");
});

test("createJsonReporter records user logs", async () => {
  const reporter = createJsonReporter({ write() {} });

  smoke.suite("json log report", async (t) => {
    await t.log("suite note");
    await t.step("log step", async () => {
      await t.log("step note");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });
  const report = reporter.report();

  assert.equal(result.status, "passed");
  assert.deepEqual(report.suites[0].logs, [{ message: "suite note" }]);
  assert.deepEqual(report.suites[0].steps[0].logs, [{ message: "step note" }]);
});

test("createTerminalReporter writes concise passing output", async () => {
  let output = "";
  const reporter = createTerminalReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("terminal pass", async (t) => {
    await t.step("check value", () => undefined);
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "passed");
  assert.match(output, /smoque/u);
  assert.match(output, /terminal pass/u);
  assert.match(output, /PASS check value/u);
  assert.match(output, /Result: passed/u);
});

test("createTerminalReporter writes user logs", async () => {
  let output = "";
  const reporter = createTerminalReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("terminal logs", async (t) => {
    await t.log("suite note");
    await t.step("log step", async () => {
      await t.log("step note");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "passed");
  assert.match(output, /LOG suite note/u);
  assert.match(output, /LOG step note/u);
  assert.match(output, /Result: passed/u);
});

test("createTerminalReporter writes skipped steps without failure details", async () => {
  let output = "";
  const reporter = createTerminalReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("terminal skip", async (t) => {
    await t.step("skip branch", () => t.skip("not relevant"));
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.suites[0].status, "skipped");
  assert.match(output, /SKIP skip branch/u);
  assert.match(output, /Result: passed/u);
  assert.doesNotMatch(output, /FAIL skip branch/u);
  assert.doesNotMatch(output, /Failure: terminal skip > skip branch/u);
});

test("createTerminalReporter writes failure details for commands", async () => {
  let output = "";
  const reporter = createTerminalReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("terminal fail", async (t) => {
    await t.step("run bad command", () =>
      t.cmd(process.execPath, [
        "-e",
        "console.log('before'); console.error('broken'); process.exit(9);",
      ]),
    );
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.match(output, /FAIL run bad command/u);
  assert.match(output, /Failure: terminal fail > run bad command/u);
  assert.match(output, /CommandFailedError/u);
  assert.match(output, /Command:/u);
  assert.match(output, /Exit code:\n  9/u);
  assert.match(output, /stderr:\n  broken/u);
  assert.match(output, /stdout:\n  before/u);
});

test("createTerminalReporter writes probe timeout details", async () => {
  let output = "";
  const reporter = createTerminalReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("terminal probe fail", async (t) => {
    await t.step("start service", () =>
      t.process.start(
        process.execPath,
        [
          "-e",
          "console.log('booting service'); console.error('missing DATABASE_URL'); setInterval(() => {}, 1000);",
        ],
        {
          ready: {
            description: "service ready",
            async check() {
              return { ready: false, message: "still booting" };
            },
          },
          timeout: "1s",
        },
      ),
    );
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.match(output, /FAIL start service/u);
  assert.match(output, /Failure: terminal probe fail > start service/u);
  assert.match(output, /ProbeTimeoutError/u);
  assert.match(output, /Details:/u);
  assert.match(output, /probe: service ready/u);
  assert.match(output, /lastMessage: still booting/u);
  assert.match(output, /stdout:\n  booting service/u);
  assert.match(output, /stderr:\n  missing DATABASE_URL/u);
});

test("createTerminalReporter writes artifacts for failed steps", async () => {
  let output = "";
  const reporter = createTerminalReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("terminal artifact fail", async (t) => {
    await t.step("collect debug output", async () => {
      await t.attach.text("debug-note", "fixture details");
      throw new Error("debug me");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.match(output, /Failure: terminal artifact fail > collect debug output/u);
  assert.match(output, /Artifacts:/u);
  assert.match(output, /debug-note: .*debug-note/u);
});

test("createJUnitReporter writes CI-friendly failure XML", async () => {
  let output = "";
  const reporter = createJUnitReporter({
    write(text) {
      output = text;
    },
  });

  smoke.suite("junit fail & escape", async (t) => {
    await t.step("bad <command>", () =>
      t.cmd(process.execPath, [
        "-e",
        "console.log('<before>'); console.error('broken & bad'); process.exit(3);",
      ]),
    );
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.match(output, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
  assert.match(output, /<testsuites name="smoque" tests="1" failures="1" skipped="0"/u);
  assert.match(
    output,
    /<testsuite name="junit fail &amp; escape" tests="1" failures="1" skipped="0"/u,
  );
  assert.match(output, /<testcase classname="junit fail &amp; escape" name="bad &lt;command&gt;"/u);
  assert.match(output, /<failure message="Command failed with exit code 3:/u);
  assert.match(output, /<system-out>&lt;before&gt;\n\s*<\/system-out>/u);
  assert.match(output, /<system-err>broken &amp; bad\n\s*<\/system-err>/u);
});

test("createJUnitReporter writes skipped steps", async () => {
  let output = "";
  const reporter = createJUnitReporter({
    write(text) {
      output = text;
    },
  });

  smoke.suite("junit skip", async (t) => {
    await t.step("skip branch", () => t.skip("not useful here"));
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "passed");
  assert.match(output, /<testsuites name="smoque" tests="1" failures="0" skipped="1"/u);
  assert.match(output, /<testsuite name="junit skip" tests="1" failures="0" skipped="1"/u);
  assert.match(output, /<testcase classname="junit skip" name="skip branch"/u);
  assert.match(output, /<skipped message="not useful here" \/>/u);
});

test("createJUnitReporter writes user logs to system-out", async () => {
  let output = "";
  const reporter = createJUnitReporter({
    write(text) {
      output = text;
    },
  });

  smoke.suite("junit logs", async (t) => {
    await t.step("log step", async () => {
      await t.log("step note");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "passed");
  assert.match(output, /<system-out>step note<\/system-out>/u);
});

test("createJUnitReporter writes a report file", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-junit-reporter-"));
  const reportPath = join(root, "smoke-report.xml");

  try {
    smoke.suite("junit file report", () => undefined);

    const reporter = createJUnitReporter({ path: reportPath });
    const result = await runRegisteredSuites({
      repoRoot: root,
      eventSink: reporter,
    });
    const output = await readFile(reportPath, "utf8");

    assert.equal(result.status, "passed");
    assert.match(output, /<testsuite name="junit file report" tests="1" failures="0" skipped="0"/u);
    assert.match(output, /<testcase classname="junit file report" name="junit file report"/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createGitHubReporter writes escaped failure annotations", async () => {
  let output = "";
  const reporter = createGitHubReporter({
    write(text) {
      output += text;
    },
  });

  smoke.suite("github, suite", async (t) => {
    await t.step("bad: step", () => {
      throw new Error("broken % value\nnext line");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.match(
    output,
    /^::error file=.*reporters\.test\.ts,title=github%2C suite > bad%3A step::Error: broken %25 value%0Anext line$/mu,
  );
});
