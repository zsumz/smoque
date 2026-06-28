import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, test } from "vitest";

import {
  createGitHubReporter,
  createJUnitReporter,
  createJsonReporter,
  createTerminalReporter,
  resetSmokeRegistry,
  runRegisteredSuites,
  smoke,
} from "../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.redact scrubs command failures before reporters receive them", async () => {
  const secret = "postgres://user:pass@example.test/app";
  const regexSecret = "api-key-12345";
  const outputs = captureReporters();

  smoke.suite("redacted command", async (t) => {
    t.redact(secret);
    t.redact(/api-key-\d+/u);

    await t.step("fail with secret output", async () => {
      await t.cmd(process.execPath, [
        "-e",
        `
          console.log(${JSON.stringify(`stdout ${secret} ${regexSecret}`)});
          console.error(${JSON.stringify(`stderr ${secret} ${regexSecret}`)});
          process.exit(7);
        `,
      ]);
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: outputs.reporter,
  });

  assert.equal(result.status, "failed");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(secret), "u"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(regexSecret), "u"));
  assertAllRedacted(outputs.values(), secret);
  assertAllRedacted(outputs.values(), regexSecret);
  assert.match(outputs.terminal, /\[redacted\]/u);
  assert.match(outputs.json, /\[redacted\]/u);
  assert.match(outputs.junit, /\[redacted\]/u);
  assert.match(outputs.github, /\[redacted\]/u);
});

test("t.redact scrubs process readiness details", async () => {
  const secret = "process-token-123";
  let terminal = "";
  const reporter = createTerminalReporter({
    write(text) {
      terminal += text;
    },
  });

  smoke.suite("redacted process", async (t) => {
    t.redact(secret);

    await t.step("timeout with secret logs", () =>
      t.process.start(
        process.execPath,
        [
          "-e",
          `
            console.log(${JSON.stringify(`boot ${secret}`)});
            console.error(${JSON.stringify(`err ${secret}`)});
            setInterval(() => {}, 1000);
          `,
        ],
        {
          ready: {
            description: `secret probe ${secret}`,
            async check() {
              return { ready: false, message: `waiting ${secret}` };
            },
          },
          timeout: "500ms",
        },
      ),
    );
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(secret), "u"));
  assert.doesNotMatch(terminal, new RegExp(escapeRegExp(secret), "u"));
  assert.match(terminal, /\[redacted\]/u);
});

test("env string redaction registers read values", async () => {
  const secret = "env-token-456";
  const previous = process.env.SMOQUE_REDACTION_SECRET;
  let terminal = "";
  process.env.SMOQUE_REDACTION_SECRET = secret;

  try {
    const reporter = createTerminalReporter({
      write(text) {
        terminal += text;
      },
    });

    smoke.suite("redacted env", async (t) => {
      const value = t.env.string("SMOQUE_REDACTION_SECRET", { required: true, redact: true });

      await t.step("fail with env value", () => {
        throw new Error(`env value ${value}`);
      });
    });

    const result = await runRegisteredSuites({
      repoRoot: process.cwd(),
      eventSink: reporter,
    });

    assert.equal(result.status, "failed");
    assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(secret), "u"));
    assert.doesNotMatch(terminal, new RegExp(escapeRegExp(secret), "u"));
    assert.match(terminal, /\[redacted\]/u);
  } finally {
    if (previous === undefined) {
      delete process.env.SMOQUE_REDACTION_SECRET;
    } else {
      process.env.SMOQUE_REDACTION_SECRET = previous;
    }
  }
});

test("redaction applies to artifact metadata", async () => {
  const secret = "artifact-token-789";
  let terminal = "";
  const reporter = createTerminalReporter({
    write(text) {
      terminal += text;
    },
  });

  smoke.suite("redacted artifact", async (t) => {
    t.redact(secret);

    await t.step("attach secret artifact name", async () => {
      await t.attach.text(`debug-${secret}`, "attached text is not persisted yet");
      throw new Error("show artifacts");
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });

  assert.equal(result.status, "failed");
  assert.doesNotMatch(terminal, new RegExp(escapeRegExp(secret), "u"));
  assert.match(terminal, /debug-\[redacted\]/u);
});

test("redaction applies to text artifact contents", async () => {
  const secret = "artifact-content-token-789";
  const reporter = createJsonReporter({ write() {} });

  smoke.suite("redacted artifact contents", async (t) => {
    t.redact(secret);

    await t.step("attach secret artifact content", async () => {
      await t.attach.text("debug-output.txt", `token=${secret}`);
    });
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });
  const artifact = reporter.report().suites[0].steps[0].artifacts[0];
  const content = await readFile(artifact.path, "utf8");

  assert.equal(result.status, "passed");
  assert.equal(content, "token=[redacted]");
});

function captureReporters() {
  let terminal = "";
  let json = "";
  let junit = "";
  let github = "";

  const reporters = [
    createTerminalReporter({ write: (text) => (terminal += text) }),
    createJsonReporter({ write: (text) => (json += text) }),
    createJUnitReporter({ write: (text) => (junit += text) }),
    createGitHubReporter({ write: (text) => (github += text) }),
  ];

  return {
    get terminal() {
      return terminal;
    },
    get json() {
      return json;
    },
    get junit() {
      return junit;
    },
    get github() {
      return github;
    },
    values() {
      return [terminal, json, junit, github];
    },
    reporter: {
      async emit(event) {
        await Promise.all(reporters.map((reporter) => reporter.emit(event)));
      },
    },
  };
}

function assertAllRedacted(values, secret) {
  const secretPattern = new RegExp(escapeRegExp(secret), "u");
  for (const value of values) {
    assert.doesNotMatch(value, secretPattern);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
