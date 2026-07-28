import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface FakePostgresDockerCommand {
    args: string[];
    cwd: string;
}

export async function createFakePostgresDocker(root: string): Promise<string> {
    const script = join(root, 'docker');
    const log = join(root, 'docker-commands.jsonl');
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
        'utf8',
    );
    await chmod(script, 0o755);
    return script;
}

export async function readFakePostgresDockerLog(
    root: string,
): Promise<FakePostgresDockerCommand[]> {
    const value = await readFile(join(root, 'docker-commands.jsonl'), 'utf8');
    return value.trim().split(/\r?\n/u).filter(Boolean).map(parseFakePostgresDockerCommand);
}

function parseFakePostgresDockerCommand(line: string): FakePostgresDockerCommand {
    const value: unknown = JSON.parse(line);
    assert.ok(typeof value === 'object' && value !== null);
    assert.ok('args' in value && isStringArray(value.args));
    assert.ok('cwd' in value && typeof value.cwd === 'string');
    return { args: value.args, cwd: value.cwd };
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}
