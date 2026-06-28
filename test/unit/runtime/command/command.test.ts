import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.cmd captures stdout, stderr, exit code, cwd, and command events", async () => {
  const events = [];

  smoke.suite("command smoke", async (t) => {
    const result = await t.step("run node command", () =>
      t.cmd(process.execPath, [
        "-e",
        "console.log(process.cwd()); console.error('warn');",
      ]),
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.cwd, process.cwd());
    assert.match(result.stdout, new RegExp(escapeRegExp(process.cwd()), "u"));
    assert.equal(result.stderr, "warn\n");
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: {
      emit(event) {
        events.push(event);
      },
    },
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "run.started",
      "suite.discovered",
      "suite.started",
      "step.started",
      "command.started",
      "command.output",
      "command.output",
      "command.finished",
      "step.passed",
      "suite.finished",
      "run.finished",
    ],
  );
  assert.equal(events.find((event) => event.type === "command.started").stepId, "suite-1:step-1");
});

test("t.cmd throws on non-zero exit by default", async () => {
  smoke.suite("failing command", async (t) => {
    await t.step("run bad command", () =>
      t.cmd(process.execPath, ["-e", "console.error('nope'); process.exit(7);"]),
    );
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });
  const suite = result.suites[0];
  const step = suite.steps[0];

  assert.equal(result.status, "failed");
  assert.equal(suite.error.name, "CommandFailedError");
  assert.equal(suite.error.details.exitCode, 7);
  assert.equal(step.error.details.stderr, "nope\n");
});

test("t.cmd returns non-zero results when check is false", async () => {
  smoke.suite("expected command failure", async (t) => {
    const result = await t.step("run expected failure", () =>
      t.cmd(process.execPath, ["-e", "console.error('expected'); process.exit(4);"], { check: false }),
    );

    assert.equal(result.exitCode, 4);
    assert.equal(result.stderr, "expected\n");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("t.cmd supports env overrides and stdin", async () => {
  smoke.suite("env and stdin", async (t) => {
    const result = await t.step("read stdin and env", () =>
      t.cmd(
        process.execPath,
        ["-e", "process.stdin.on('data', (d) => console.log(`${process.env.SMOKR_WORD}:${d}`));"],
        {
          env: { SMOKR_WORD: "hello" },
          stdin: "smoke",
        },
      ),
    );

    assert.equal(result.stdout, "hello:smoke\n");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("t.cmd fails when the command times out", async () => {
  smoke.suite("timeout command", async (t) => {
    await t.step("hang briefly", () => t.cmd(process.execPath, ["-e", "setTimeout(() => {}, 1000);"], { timeout: "50ms" }));
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });
  const suite = result.suites[0];

  assert.equal(result.status, "failed");
  assert.equal(suite.error.name, "CommandFailedError");
  assert.equal(suite.error.details.timeout, "50ms");
  assert.match(suite.error.message, /timed out/u);
});

test(
  "t.cmd timeout terminates child processes",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "smoque-command-tree-"));
    const childPidFile = join(root, "child-pid.txt");

    smoke.suite("timeout command tree", async (t) => {
      await t.step("hang with child process", () =>
        t.cmd(
          process.execPath,
          [
            "-e",
            `
            const { spawn } = require("node:child_process");
            const fs = require("node:fs");
            const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], { stdio: "ignore" });
            fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid));
            setInterval(() => {}, 1000);
          `,
          ],
          { timeout: "500ms" },
        ),
      );
    });

    try {
      const result = await runRegisteredSuites({ repoRoot: root });
      const childPid = Number.parseInt(await readFile(childPidFile, "utf8"), 10);

      assert.equal(result.status, "failed");
      assert.equal(result.suites[0].error.name, "CommandFailedError");
      await waitForProcessExit(childPid);
      assert.equal(isProcessAlive(childPid), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("t.sh intentionally runs through the platform shell", async () => {
  smoke.suite("shell command", async (t) => {
    const result = await t.step("run shell", () => t.sh("printf shell-ok"));

    assert.equal(result.stdout, "shell-ok");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForProcessExit(pid) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1000) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await sleep(20);
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
