import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.ports reserves unique loopback ports and builds env maps", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-ports-"));

  try {
    smoke.suite("ports", async (t) => {
      const api = await t.ports.reserve("api");
      const worker = await t.ports.reserve("worker");

      assert.equal(api.host, "127.0.0.1");
      assert.notEqual(api.port, worker.port);
      assert.equal(api.url("/health"), `http://127.0.0.1:${api.port}/health`);

      const result = await t.cmd(process.execPath, [
        "-e",
        "console.log(`${process.env.PORT}:${process.env.NAME}:${process.env.REMOVED ?? 'missing'}`)",
      ], {
        env: t.ports.env({
          PORT: api,
          NAME: "demo",
          REMOVED: undefined,
        }),
      });

      assert.equal(result.stdout.trim(), `${api.port}:demo:missing`);
    });

    const result = await runRegisteredSuites({ repoRoot: root });
    assert.equal(result.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("command failures include reserved port diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-ports-command-failure-"));
  let port;

  try {
    smoke.suite("port command failure", async (t) => {
      port = await t.ports.reserve("api");

      await t.step("fail command with port env", async () => {
        await t.cmd(process.execPath, ["-e", "process.exit(7)"], {
          env: t.ports.env({ PORT: port }),
        });
      });
    });

    const result = await runRegisteredSuites({ repoRoot: root });
    const details = result.suites[0].steps[0].error.details;

    assert.equal(result.status, "failed");
    assert.deepEqual(details.reservedPorts, {
      api: {
        host: "127.0.0.1",
        port: port.port,
        env: "PORT",
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("process readiness failures include reserved port diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-ports-process-failure-"));
  let port;

  try {
    smoke.suite("port process failure", async (t) => {
      port = await t.ports.reserve("api");

      await t.step("fail process readiness with port env", async () => {
        await t.process.start(process.execPath, ["-e", "setTimeout(() => undefined, 5000)"], {
          env: t.ports.env({ PORT: port }),
          name: "api",
          ready: t.log.contains("ready", { stream: "stdout" }),
          timeout: "30ms",
        });
      });
    });

    const result = await runRegisteredSuites({ repoRoot: root });
    const details = result.suites[0].steps[0].error.details;

    assert.equal(result.status, "failed");
    assert.deepEqual(details.reservedPorts, {
      api: {
        host: "127.0.0.1",
        port: port.port,
        env: "PORT",
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
