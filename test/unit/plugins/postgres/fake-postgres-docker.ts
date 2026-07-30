import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
    readFakeCommandLog,
    type FakeCommand,
} from '../fake-command-log.js';

export type FakePostgresDockerCommand = FakeCommand;

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
    return await readFakeCommandLog(join(root, 'docker-commands.jsonl'));
}
