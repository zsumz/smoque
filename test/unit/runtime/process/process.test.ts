import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.process.start waits for readiness and stop is idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-process-ready-"));
  const readyFile = join(root, "ready.txt");
  let pid;

  smoke.suite("ready process", async (t) => {
    const app = await t.process.start(
      process.execPath,
      [
        "-e",
        `
          const fs = require("node:fs");
          setTimeout(() => fs.writeFileSync(${JSON.stringify(readyFile)}, "ready"), 20);
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.fs.ready(readyFile),
        timeout: "2s",
      },
    );

    pid = app.pid;
    assert.equal(await t.fs.readText(readyFile), "ready");
    await app.stop();
    await app.stop();
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    assert.equal(isProcessAlive(pid), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.process.start waits for TCP readiness", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-process-tcp-ready-"));
  const port = await getFreePort();
  let pid;

  smoke.suite("tcp ready process", async (t) => {
    const app = await t.process.start(
      process.execPath,
      [
        "-e",
        `
          const net = require("node:net");
          const server = net.createServer((socket) => socket.end("ok"));
          setTimeout(() => server.listen(${port}, "127.0.0.1"), 20);
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.tcp.ready({ port, timeout: "250ms" }),
        timeout: "2s",
      },
    );

    pid = app.pid;
    assert.deepEqual(await t.tcp.ready(port).check(), { ready: true, message: "connected" });
    await app.stop();
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    assert.equal(isProcessAlive(pid), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.process.start waits for stdout log readiness", async () => {
  let pid;

  smoke.suite("stdout log ready process", async (t) => {
    const app = await t.process.start(
      process.execPath,
      [
        "-e",
        `
          setTimeout(() => console.log("service ready"), 20);
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.log.contains(/service ready/u, { stream: "stdout" }),
        timeout: "2s",
      },
    );

    pid = app.pid;
    assert.match(app.stdout(), /service ready/u);
    await app.stop();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.equal(isProcessAlive(pid), false);
});

test("t.process.start waits for stderr log readiness", async () => {
  smoke.suite("stderr log ready process", async (t) => {
    const app = await t.process.start(
      process.execPath,
      [
        "-e",
        `
          setTimeout(() => console.error("listening on stderr"), 20);
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.log.contains("listening on stderr", { stream: "stderr" }),
        timeout: "2s",
      },
    );

    assert.match(app.stderr(), /listening on stderr/u);
    await app.stop();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("t.process.start registers cleanup automatically", async () => {
  let pid;

  smoke.suite("auto cleanup process", async (t) => {
    const app = await t.process.start(process.execPath, ["-e", "setInterval(() => {}, 1000);"]);
    pid = app.pid;
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.equal(isProcessAlive(pid), false);
});

test(
  "t.process.start stop terminates child processes",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "smoque-process-tree-"));
    const childPidFile = join(root, "child-pid.txt");
    let childPid;

    smoke.suite("process tree cleanup", async (t) => {
      const app = await t.process.start(
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
        {
          ready: t.fs.ready(childPidFile),
          timeout: "2s",
        },
      );

      childPid = Number.parseInt(await t.fs.readText(childPidFile), 10);
      await app.stop();
    });

    try {
      const result = await runRegisteredSuites({ repoRoot: root });

      assert.equal(result.status, "passed");
      await waitForProcessExit(childPid);
      assert.equal(isProcessAlive(childPid), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("t.process.start stops the child when readiness times out", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-process-timeout-"));
  const pidFile = join(root, "pid.txt");

  smoke.suite("timeout process", async (t) => {
    await t.process.start(
      process.execPath,
      [
        "-e",
        `
          const fs = require("node:fs");
          fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: {
          description: "never ready",
          async check() {
            return { ready: false, message: "still booting" };
          },
        },
        timeout: "1s",
      },
    );
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });
    const pid = Number.parseInt(await readFile(pidFile, "utf8"), 10);

    assert.equal(result.status, "failed");
    assert.equal(result.suites[0].error.name, "ProbeTimeoutError");
    assert.equal(result.suites[0].error.details.lastMessage, "still booting");
    assert.equal(isProcessAlive(pid), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.process.group starts named processes and stops them in reverse order", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-process-group-"));
  const stopFile = join(root, "stops.txt");
  let appPid;
  let workerPid;

  smoke.suite("process group", async (t) => {
    const group = t.process.group("demo-stack");
    const app = await group.start(
      "app",
      process.execPath,
      [
        "-e",
        `
          const fs = require("node:fs");
          process.on("SIGTERM", () => {
            fs.appendFileSync(${JSON.stringify(stopFile)}, "app\\n");
            process.exit(0);
          });
          console.log("app ready");
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.log.contains("app ready", { stream: "stdout" }),
        timeout: "2s",
      },
    );
    const worker = await group.start(
      "worker",
      process.execPath,
      [
        "-e",
        `
          const fs = require("node:fs");
          process.on("SIGTERM", () => {
            fs.appendFileSync(${JSON.stringify(stopFile)}, "worker\\n");
            process.exit(0);
          });
          console.log("worker ready");
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.log.contains("worker ready", { stream: "stdout" }),
        timeout: "2s",
      },
    );

    appPid = app.pid;
    workerPid = worker.pid;
    assert.equal(group.get("app"), app);
    assert.equal(group.get("worker"), worker);

    await group.stop();
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    assert.equal(isProcessAlive(appPid), false);
    assert.equal(isProcessAlive(workerPid), false);
    assert.deepEqual((await readFile(stopFile, "utf8")).trim().split("\n"), ["worker", "app"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.process.group stops started processes and attaches logs when a later process fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-process-group-failure-"));
  const events = [];
  let appPid;

  smoke.suite("process group failure", async (t) => {
    const group = t.process.group("demo-stack");
    const app = await group.start(
      "app",
      process.execPath,
      [
        "-e",
        `
          console.log("app ready");
          setInterval(() => {}, 1000);
        `,
      ],
      {
        ready: t.log.contains("app ready", { stream: "stdout" }),
        timeout: "2s",
      },
    );
    appPid = app.pid;

    await group.start(
      "worker",
      process.execPath,
      ["-e", "console.error('worker boot failed'); process.exit(13);"],
      {
        ready: t.log.contains("worker ready", { stream: "stdout" }),
        timeout: "1s",
      },
    );
  });

  try {
    const result = await runRegisteredSuites({
      repoRoot: root,
      eventSink: {
        emit(event) {
          events.push(event);
        },
      },
    });
    const error = result.suites[0].error;
    const appStdout = events.find((event) => event.type === "artifact.attached" && event.name === "demo-stack-app-stdout.log");

    assert.equal(result.status, "failed");
    assert.match(error.message, /Process group "demo-stack" failed starting "worker"/u);
    assert.equal(error.details.processGroup, "demo-stack");
    assert.equal(error.details.processName, "worker");
    assert.match(error.details.stderr, /worker boot failed/u);
    assert.equal(isProcessAlive(appPid), false);
    assert.ok(appStdout);
    assert.match(await readFile(appStdout.path, "utf8"), /app ready/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function isProcessAlive(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function getFreePort() {
  const server = createServer();
  await listen(server);
  const { port } = server.address();
  await close(server);
  return port;
}
