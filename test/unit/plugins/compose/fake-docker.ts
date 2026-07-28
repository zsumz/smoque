import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type FakeDockerMode = 'ok' | 'missing-compose' | 'up-fails';

export interface FakeDockerCommand {
    args: string[];
    cwd: string;
}

export async function createFakeDocker(
    root: string,
    mode: FakeDockerMode = 'ok',
): Promise<string> {
    const script = join(root, 'docker');
    const log = join(root, 'docker-commands.jsonl');
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
        'utf8',
    );
    await chmod(script, 0o755);
    return script;
}

export async function readFakeDockerLog(root: string): Promise<FakeDockerCommand[]> {
    const value = await readFile(join(root, 'docker-commands.jsonl'), 'utf8');
    return value.trim().split(/\r?\n/u).filter(Boolean).map(parseFakeDockerCommand);
}

function parseFakeDockerCommand(line: string): FakeDockerCommand {
    const value: unknown = JSON.parse(line);
    assert.ok(typeof value === 'object' && value !== null);
    assert.ok('args' in value && isStringArray(value.args));
    assert.ok('cwd' in value && typeof value.cwd === 'string');
    return { args: value.args, cwd: value.cwd };
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}
