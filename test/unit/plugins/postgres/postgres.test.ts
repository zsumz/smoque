import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";
import { SmokeError } from "../../../../dist/errors.js";
import composePlugin from "../../../../dist/plugins/compose.js";
import { parseCsv } from "../../../../dist/plugins/postgres/csv.js";
import { postgresQueryError, postgresSqlError } from "../../../../dist/plugins/postgres/errors.js";
import postgresPlugin from "../../../../dist/plugins/postgres.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("postgres CSV parser handles quoted and ragged rows", () => {
  assert.deepEqual(parseCsv(""), []);

  const rows = parseCsv([
    "id,name,note",
    "1,\"Ada, Lovelace\",\"said \"\"hello\"\"\"",
    "2,\"Grace",
    "Hopper\",line break",
    "",
    "3,Bob,",
    "4,OnlyName",
    "",
  ].join("\r\n"));

  assert.deepEqual(rows, [
    { id: "1", name: "Ada, Lovelace", note: "said \"hello\"" },
    { id: "2", name: "Grace\r\nHopper", note: "line break" },
    { id: "3", name: "Bob", note: "" },
    { id: "4", name: "OnlyName", note: "" },
  ]);
});

test("postgres error wrappers preserve details, SQL, and params", () => {
  const sql = "select * from users where id = :'id'";
  const params = { id: 7 };
  const cause = new SmokeError("psql exited 2", {
    command: "psql",
    stdout: "partial output",
    stderr: "syntax error",
  });

  const queryWrapped = postgresQueryError(cause, sql, params);
  assert.equal(queryWrapped.message, "Postgres query failed: psql exited 2");
  assert.equal(queryWrapped.details.command, "psql");
  assert.equal(queryWrapped.details.stdout, "partial output");
  assert.equal(queryWrapped.details.stderr, "syntax error");
  assert.equal(queryWrapped.details.sql, sql);
  assert.deepEqual(queryWrapped.details.params, params);

  const queryString = postgresQueryError("network closed", sql, params);
  assert.equal(queryString.message, "Postgres query failed: network closed");
  assert.equal(queryString.details.sql, sql);
  assert.deepEqual(queryString.details.params, params);

  const sqlWrapped = postgresSqlError(cause, sql, params);
  assert.equal(sqlWrapped.message, "Postgres SQL command failed: psql exited 2");
  assert.equal(sqlWrapped.details.stderr, "syntax error");
  assert.equal(sqlWrapped.details.sql, sql);
  assert.deepEqual(sqlWrapped.details.params, params);

  const sqlString = postgresSqlError("permission denied", sql, params);
  assert.equal(sqlString.message, "Postgres SQL command failed: permission denied");
  assert.equal(sqlString.details.sql, sql);
  assert.deepEqual(sqlString.details.params, params);
});

test("postgres psql check parses typical versions and allows missing version text", async () => {
  for (const [versionOutput, expectedVersion] of [
    ["psql (PostgreSQL) 16.2", "16.2"],
    ["psql (PostgreSQL) 15.6 (Homebrew)", "15.6"],
    ["psql from custom build", undefined],
  ]) {
    resetSmokeRegistry();
    const root = await mkdtemp(join(tmpdir(), "smoque-postgres-check-"));
    const psql = await createFakePsql(root, { versionOutput });
    let info;

    smoke.use(postgresPlugin());
    smoke.suite("postgres check", async (t) => {
      info = await t.postgres.check({ psql });
    });

    try {
      const result = await runRegisteredSuites({ repoRoot: root });

      assert.equal(result.status, "passed");
      assert.equal(info.psql.command, psql);
      assert.equal(info.psql.version, expectedVersion);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("postgres psql check failure preserves command output", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-check-failure-"));
  const psql = await createFakePsql(root, {
    versionExitCode: 127,
    versionOutput: "partial version output",
    versionStderr: "psql missing",
  });

  smoke.use(postgresPlugin());
  smoke.suite("postgres check failure", async (t) => {
    await t.postgres.check({ psql });
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });
    const error = result.suites[0].error;

    assert.equal(result.status, "failed");
    assert.equal(error.name, "SmokeError");
    assert.match(error.message, /Postgres psql client is not available/u);
    assert.equal(error.details.command, psql);
    assert.deepEqual(error.details.args, ["--version"]);
    assert.equal(error.details.exitCode, 127);
    assert.equal(error.details.stdout, "partial version output\n");
    assert.equal(error.details.stderr, "psql missing\n");
    assert.match(error.details.installHint, /Install PostgreSQL client tools/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("postgres plugin connects with psql and asserts query rows", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-"));
  const psql = await createFakePsql(root);

  smoke.use(postgresPlugin());
  smoke.suite("postgres query", async (t) => {
    const info = await t.postgres.check({ psql });
    assert.equal(info.psql.command, psql);
    assert.equal(info.psql.version, "16.2");

    const db = await t.postgres.connect({
      url: "postgres://user:secret@127.0.0.1:5432/app",
      psql,
    });

    await db.sql("create table users(id int, name text)");
    const result = await db.query("select id, name from users where id = :'id'", {
      params: { id: 1 },
    });

    result.expectRow({ id: 1, name: "Ada" }).expectRows([{ id: 1, name: "Ada" }]);
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    const log = await readJsonl(join(root, "psql-commands.jsonl"));
    assert.ok(log.some((entry) => entry.args.includes("--version")));
    assert.ok(log.some((entry) => entry.args.includes("--set") && entry.args.includes("id=1")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("postgres row assertions report query text, params, and row preview", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-failure-"));
  const psql = await createFakePsql(root);

  smoke.use(postgresPlugin());
  smoke.suite("postgres assertion failure", async (t) => {
    const db = await t.postgres.connect({
      url: "postgres://user:secret@127.0.0.1:5432/app",
      psql,
    });

    const result = await db.query("select id, name from users where id = :'id'", {
      params: { id: 2 },
    });
    result.expectRow({ id: 99 });
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "failed");
    assert.match(result.suites[0].error.message, /Expected Postgres query/u);
    assert.equal(result.suites[0].error.details.sql, "select id, name from users where id = :'id'");
    assert.deepEqual(result.suites[0].error.details.params, { id: 2 });
    assert.deepEqual(result.suites[0].error.details.preview, [{ id: "1", name: "Ada" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("postgres query failures preserve command diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-query-fails-"));
  const psql = await createFakePsql(root, { queryFails: true });

  smoke.use(postgresPlugin());
  smoke.suite("postgres query command failure", async (t) => {
    const db = await t.postgres.connect({
      url: "postgres://user:secret@127.0.0.1:5432/app",
      psql,
    });

    await db.query("select broken from users where id = :'id'", {
      params: { id: 7 },
    });
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });
    const error = result.suites[0].error;

    assert.equal(result.status, "failed");
    assert.match(error.message, /Postgres query failed/u);
    assert.equal(error.details.sql, "select broken from users where id = :'id'");
    assert.deepEqual(error.details.params, { id: 7 });
    assert.equal(error.details.command, psql);
    assert.ok(error.details.args.includes("--command"));
    assert.equal(error.details.exitCode, 13);
    assert.equal(error.details.stdout, "partial query output\n");
    assert.equal(error.details.stderr, "syntax error at or near broken\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("postgres plugin can start a disposable database through compose", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-start-"));
  const docker = await createFakeDocker(root);
  const psql = await createFakePsql(root);

  smoke.use(composePlugin());
  smoke.use(postgresPlugin());
  smoke.suite("postgres start", async (t) => {
    const db = await t.postgres.start({
      docker,
      psql,
      projectName: "Pg Stack",
      database: "demo",
      timeout: "5s",
    });

    assert.equal(db.url, "postgres://postgres:postgres@127.0.0.1:55432/demo");
    await db.sql("select 1");
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    const dockerLog = await readJsonl(join(root, "docker-commands.jsonl"));
    assert.ok(dockerLog.some((entry) => entry.args.includes("up")));
    assert.ok(dockerLog.some((entry) => entry.args.includes("port")));
    assert.ok(dockerLog.some((entry) => entry.args.includes("down")));

    const psqlLog = await readJsonl(join(root, "psql-commands.jsonl"));
    assert.ok(psqlLog.some((entry) => entry.args.some((arg) => arg.includes("select 1 as ok"))));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("postgres.start retries readiness until the database accepts queries", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-start-retry-"));
  const docker = await createFakeDocker(root);
  const psql = await createFakePsql(root, { readyFailures: 2 });

  smoke.use(composePlugin());
  smoke.use(postgresPlugin());
  smoke.suite("postgres start retry", async (t) => {
    const db = await t.postgres.start({
      docker,
      psql,
      timeout: "2s",
    });

    assert.equal(db.url, "postgres://postgres:postgres@127.0.0.1:55432/app");
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
    const psqlLog = await readJsonl(join(root, "psql-commands.jsonl"));
    assert.equal(
      psqlLog.filter((entry) => entry.args.some((arg) => arg.includes("select 1 as ok"))).length,
      3,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("postgres.start timeout preserves readiness query diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-postgres-start-timeout-"));
  const docker = await createFakeDocker(root);
  const psql = await createFakePsql(root, { readyFailures: 99 });

  smoke.use(composePlugin());
  smoke.use(postgresPlugin());
  smoke.suite("postgres start timeout", async (t) => {
    await t.postgres.start({
      docker,
      psql,
      timeout: "300ms",
    });
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });
    const error = result.suites[0].error;

    assert.equal(result.status, "failed");
    assert.equal(error.name, "ProbeTimeoutError");
    assert.equal(error.details.name, "Postgres readiness");
    assert.equal(error.details.lastError.details.sql, "select 1 as ok");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createFakePsql(root, options = {}) {
  const script = join(root, "psql");
  const log = join(root, "psql-commands.jsonl");
  const readyAttempts = join(root, "psql-ready-attempts.txt");
  const readyFailures = options.readyFailures ?? 0;
  const versionOutput = options.versionOutput ?? "psql (PostgreSQL) 16.2";
  const versionExitCode = options.versionExitCode ?? 0;
  const versionStderr = options.versionStderr ?? "";
  const queryFails = options.queryFails ?? false;
  await writeFile(
    script,
    `#!/usr/bin/env node
const fs = require("node:fs");
const log = ${JSON.stringify(log)};
const readyAttempts = ${JSON.stringify(readyAttempts)};
const readyFailures = ${JSON.stringify(readyFailures)};
const versionOutput = ${JSON.stringify(versionOutput)};
const versionExitCode = ${JSON.stringify(versionExitCode)};
const versionStderr = ${JSON.stringify(versionStderr)};
const queryFails = ${JSON.stringify(queryFails)};
const args = process.argv.slice(2);
fs.appendFileSync(log, JSON.stringify({ args, cwd: process.cwd() }) + "\\n");

if (args.includes("--version")) {
  if (versionOutput) {
    console.log(versionOutput);
  }
  if (versionStderr) {
    console.error(versionStderr);
  }
  process.exit(versionExitCode);
}

const commandIndex = args.indexOf("--command");
const command = commandIndex === -1 ? "" : args[commandIndex + 1] ?? "";

if (command.startsWith("copy (")) {
  if (command.includes("select 1 as ok")) {
    const attempts = fs.existsSync(readyAttempts) ? Number(fs.readFileSync(readyAttempts, "utf8")) : 0;
    fs.writeFileSync(readyAttempts, String(attempts + 1));
    if (attempts < readyFailures) {
      console.error("database is not ready");
      process.exit(7);
    }
    console.log("ok");
    console.log("1");
  } else {
    if (queryFails) {
      console.log("partial query output");
      console.error("syntax error at or near broken");
      process.exit(13);
    }
    console.log("id,name");
    console.log("1,Ada");
  }
  process.exit(0);
}

console.log("OK");
process.exit(0);
`,
    "utf8",
  );
  await chmod(script, 0o755);
  return script;
}

async function createFakeDocker(root) {
  const script = join(root, "docker");
  const log = join(root, "docker-commands.jsonl");
  await writeFile(
    script,
    `#!/usr/bin/env node
const fs = require("node:fs");
const log = ${JSON.stringify(log)};
const args = process.argv.slice(2);
fs.appendFileSync(log, JSON.stringify({ args, cwd: process.cwd() }) + "\\n");

if (args[0] !== "compose") {
  console.error("expected compose command");
  process.exit(2);
}

const command = args.find((arg) => ["version", "up", "down", "port", "logs"].includes(arg));

if (command === "version") {
  console.log("2.27.0");
  process.exit(0);
}

if (command === "up") {
  console.log("started");
  process.exit(0);
}

if (command === "port") {
  console.log("0.0.0.0:55432");
  process.exit(0);
}

if (command === "logs") {
  console.log("postgres | ready");
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

async function readJsonl(path) {
  const value = await readFile(path, "utf8");
  return value.trim().split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}
