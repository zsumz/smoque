import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface FakePsqlOptions {
    readonly readyFailures?: number;
    readonly versionOutput?: string;
    readonly versionExitCode?: number;
    readonly versionStderr?: string;
    readonly queryFails?: boolean;
}

export interface FakePsqlCommand {
    args: string[];
    cwd: string;
}

export async function createFakePsql(
    root: string,
    options: FakePsqlOptions = {},
): Promise<string> {
    const script = join(root, 'psql');
    const log = join(root, 'psql-commands.jsonl');
    const readyAttempts = join(root, 'psql-ready-attempts.txt');
    const readyFailures = options.readyFailures ?? 0;
    const versionOutput = options.versionOutput ?? 'psql (PostgreSQL) 16.2';
    const versionExitCode = options.versionExitCode ?? 0;
    const versionStderr = options.versionStderr ?? '';
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
  if (versionOutput) console.log(versionOutput);
  if (versionStderr) console.error(versionStderr);
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
        'utf8',
    );
    await chmod(script, 0o755);
    return script;
}

export async function readFakePsqlLog(root: string): Promise<FakePsqlCommand[]> {
    const value = await readFile(join(root, 'psql-commands.jsonl'), 'utf8');
    return value.trim().split(/\r?\n/u).filter(Boolean).map(parseFakePsqlCommand);
}

function parseFakePsqlCommand(line: string): FakePsqlCommand {
    const value: unknown = JSON.parse(line);
    assert.ok(typeof value === 'object' && value !== null);
    assert.ok('args' in value && isStringArray(value.args));
    assert.ok('cwd' in value && typeof value.cwd === 'string');
    return { args: value.args, cwd: value.cwd };
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}
