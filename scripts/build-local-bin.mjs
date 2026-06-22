#!/usr/bin/env node
import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repoRoot, parseOutputPath(process.argv.slice(2)));
const cliPath = resolve(repoRoot, "dist", "cli", "main.js");

await assertBuiltCli(cliPath);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, localBinSource(cliPath), "utf8");
await chmod(outputPath, 0o755);

console.log(`Wrote ${outputPath}`);
console.log("This launcher uses the built smoque checkout it was generated from.");

function parseOutputPath(args) {
  if (args.length === 0) {
    return "target/bin/smoque";
  }

  if (args.length === 2 && args[0] === "--output") {
    return args[1];
  }

  throw new Error("Usage: node scripts/build-local-bin.mjs [--output path]");
}

async function assertBuiltCli(path) {
  try {
    await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Missing dist/cli/main.js. Run `npm run build` first.");
    }
    throw error;
  }
}

function localBinSource(path) {
  return [
    "#!/usr/bin/env node",
    "import { spawnSync } from 'node:child_process';",
    "",
    `const cliPath = ${JSON.stringify(path)};`,
    "const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {",
    "  stdio: 'inherit',",
    "});",
    "",
    "if (result.error) {",
    "  console.error(result.error.message);",
    "  process.exit(1);",
    "}",
    "",
    "process.exit(result.status ?? 1);",
    "",
  ].join("\n");
}
