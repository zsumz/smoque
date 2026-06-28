import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";
import composePlugin from "../../../../dist/plugins/compose.js";
import { parsePublishedPort } from "../../../../dist/plugins/compose/ports.js";
import { normalizeProjectName } from "../../../../dist/plugins/compose/project-name.js";
import httpPlugin from "../../../../dist/plugins/http.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("compose published port parser handles platform-shaped output", () => {
  const ipv4 = parsePublishedPort("\n127.0.0.1:49154\n", "web", 8080);
  assert.equal(ipv4.host, "127.0.0.1");
  assert.equal(ipv4.port, 49154);
  assert.equal(ipv4.url(), "http://127.0.0.1:49154/");
  assert.equal(ipv4.url("health"), "http://127.0.0.1:49154/health");
  assert.equal(ipv4.url("/secure", "https"), "https://127.0.0.1:49154/secure");

  const bracketedIpv6 = parsePublishedPort("[::1]:49155", "web", 8080);
  assert.equal(bracketedIpv6.host, "::1");
  assert.equal(bracketedIpv6.port, 49155);
  assert.equal(bracketedIpv6.url(), "http://[::1]:49155/");

  const wildcardIpv4 = parsePublishedPort("0.0.0.0:49156", "web", 8080);
  assert.equal(wildcardIpv4.host, "127.0.0.1");

  const bracketedWildcardIpv6 = parsePublishedPort("[::]:49157", "web", 8080);
  assert.equal(bracketedWildcardIpv6.host, "127.0.0.1");

  const wildcardIpv6 = parsePublishedPort(":::49158", "web", 8080);
  assert.equal(wildcardIpv6.host, "127.0.0.1");
});

test("compose published port parser reports blank and malformed output", () => {
  for (const [output, message] of [
    ["", /Docker Compose did not report a published port for api:5432\./u],
    ["\n  \n", /Docker Compose did not report a published port for api:5432\./u],
    ["not-a-port", /Could not parse Docker Compose published port: not-a-port/u],
    ["127.0.0.1:", /Could not parse Docker Compose published port: 127\.0\.0\.1:/u],
    ["127.0.0.1:abc", /Could not parse Docker Compose published port: 127\.0\.0\.1:abc/u],
  ]) {
    assert.throws(
      () => parsePublishedPort(output, "api", 5432),
      (error) => {
        assert.match(error.message, message);
        assert.equal(error.details.service, "api");
        assert.equal(error.details.containerPort, 5432);
        assert.equal(error.details.output, output);
        return true;
      },
    );
  }
});

test("compose project names normalize common input and reject unusable names", () => {
  assert.equal(normalizeProjectName(" Smoke Demo!! "), "smoke-demo");
  assert.equal(normalizeProjectName("UPPER_case-123"), "upper_case-123");
  assert.equal(normalizeProjectName("billing/api:smoke"), "billing-api-smoke");

  const longName = normalizeProjectName("A".repeat(80));
  assert.equal(longName, "a".repeat(63));

  for (const projectName of ["", "   ", "!!!"]) {
    assert.throws(
      () => normalizeProjectName(projectName),
      (error) => {
        assert.match(error.message, /Invalid Docker Compose project name:/u);
        assert.equal(error.details.projectName, projectName);
        assert.match(
          error.details.expected,
          /lowercase letters, digits, dashes, or underscores; must start with a letter or digit/u,
        );
        return true;
      },
    );
  }
});

test("compose plugin checks docker compose, starts a project, exposes service ports, and cleans up", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-compose-"));
  const docker = await createFakeDocker(root);

  smoke.use(httpPlugin());
  smoke.use(composePlugin());
  smoke.suite("compose lifecycle", async (t) => {
    const info = await t.compose.check({ docker });
    assert.equal(info.docker.command, docker);
    assert.equal(info.compose.version, "2.27.0");

    const project = await t.compose.up({
      docker,
      file: "compose.yaml",
      projectName: "Smoke Demo",
      services: ["web"],
    });

    assert.equal(project.projectName, "smoke-demo");
    assert.deepEqual(project.files, [join(root, "compose.yaml")]);

    const web = project.service("web");
    const published = await web.port(8080);
    assert.equal(published.host, "127.0.0.1");
    assert.equal(published.port, 49154);
    assert.equal(await web.url(8080, "/health"), "http://127.0.0.1:49154/health");

    const probe = web.ready(8080, { path: "/health" });
    assert.equal(probe.description, "docker compose service web:8080 HTTP ready");
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    const log = await readFakeDockerLog(root);
    assert.ok(log.some((entry) => entry.args.join(" ") === "compose version --short"));
    assert.ok(log.some((entry) => entry.args.includes("up") && entry.args.includes("--detach")));
    assert.ok(log.some((entry) => entry.args.includes("down") && entry.args.includes("--volumes")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("compose plugin reports missing compose support with installation-oriented diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-compose-missing-"));
  const docker = await createFakeDocker(root, { mode: "missing-compose" });

  smoke.use(composePlugin());
  smoke.suite("compose missing", async (t) => {
    await t.compose.check({ docker });
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "failed");
    assert.equal(result.suites[0].error.name, "SmokeError");
    assert.match(result.suites[0].error.message, /Docker Compose is not available/u);
    assert.match(String(result.suites[0].error.details.installHint), /Docker Desktop/u);
    assert.equal(result.suites[0].error.details.exitCode, 42);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("compose plugin attaches logs and command history when startup fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-compose-failure-"));
  const docker = await createFakeDocker(root, { mode: "up-fails" });
  const artifacts = [];

  smoke.use(composePlugin());
  smoke.suite("compose failure", async (t) => {
    await t.compose.up({
      docker,
      projectName: "Failing Stack",
      services: ["api"],
    });
  });

  try {
    const result = await runRegisteredSuites({
      repoRoot: root,
      eventSink: {
        async emit(event) {
          if (event.type === "artifact.attached") {
            artifacts.push(event);
          }
        },
      },
    });

    assert.equal(result.status, "failed");
    assert.match(result.suites[0].error.message, /Docker Compose up failed/u);
    assert.ok(artifacts.some((artifact) => artifact.name === "failing-stack-compose-logs.txt"));
    assert.ok(artifacts.some((artifact) => artifact.name === "failing-stack-compose-commands.txt"));

    const logsArtifact = artifacts.find((artifact) => artifact.name === "failing-stack-compose-logs.txt");
    assert.match(await readFile(logsArtifact.path, "utf8"), /api \| boot failed/u);

    const commandArtifact = artifacts.find((artifact) => artifact.name === "failing-stack-compose-commands.txt");
    assert.match(await readFile(commandArtifact.path, "utf8"), /compose --project-name failing-stack up/u);

    const log = await readFakeDockerLog(root);
    assert.ok(log.some((entry) => entry.args.includes("logs")));
    assert.ok(log.some((entry) => entry.args.includes("down")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createFakeDocker(root, options = {}) {
  const script = join(root, "docker");
  const log = join(root, "docker-commands.jsonl");
  const mode = options.mode ?? "ok";
  await writeFile(
    script,
    `#!/usr/bin/env node
const fs = require("node:fs");
const log = ${JSON.stringify(log)};
const mode = ${JSON.stringify(mode)};
const args = process.argv.slice(2);
fs.appendFileSync(log, JSON.stringify({ args, cwd: process.cwd() }) + "\\n");

if (args[0] === "--version") {
  console.log("Docker version 27.0.0, build fake");
  process.exit(0);
}

if (args[0] !== "compose") {
  console.error("expected compose command");
  process.exit(2);
}

const command = args.find((arg) => ["version", "up", "down", "port", "logs"].includes(arg));

if (command === "version") {
  if (mode === "missing-compose") {
    console.error("docker: 'compose' is not a docker command");
    process.exit(42);
  }
  console.log("2.27.0");
  process.exit(0);
}

if (command === "up") {
  if (mode === "up-fails") {
    console.error("api failed to start");
    process.exit(17);
  }
  console.log("started");
  process.exit(0);
}

if (command === "port") {
  console.log("0.0.0.0:49154");
  process.exit(0);
}

if (command === "logs") {
  console.log("api | boot failed");
  console.log("web | ready");
  process.exit(0);
}

if (command === "down") {
  console.log("removed");
  process.exit(0);
}

console.error("unhandled compose command");
process.exit(3);
`,
    "utf8",
  );
  await chmod(script, 0o755);
  return script;
}

async function readFakeDockerLog(root) {
  const value = await readFile(join(root, "docker-commands.jsonl"), "utf8");
  return value.trim().split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}
