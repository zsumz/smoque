import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultCliTimeoutMs = 10_000;
const forceKillDelayMs = 500;

export const repoRoot = resolve(here, "../../..");
export const cliPath = resolve(repoRoot, "dist", "cli", "main.js");
export const coreUrl = pathToFileURL(resolve(repoRoot, "dist", "core.js")).href;

export function runCli(args, cwd, timeoutMs = defaultCliTimeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let forceKillTimer;
    let settled = false;
    let timedOut = false;

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
    };
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminateCliProcess(child, "SIGTERM");
      forceKillTimer = setTimeout(() => {
        terminateCliProcess(child, "SIGKILL");
      }, forceKillDelayMs);
      forceKillTimer.unref?.();
    }, timeoutMs);
    timeoutTimer.unref?.();

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      const result = {
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };

      if (timedOut) {
        reject(
          new Error(
            [
              `CLI command timed out after ${timeoutMs}ms: ${formatCliCommand(args)}`,
              `cwd: ${cwd}`,
              cliResultSummary(result),
            ].join("\n\n"),
          ),
        );
        return;
      }

      resolvePromise(result);
    });
  });
}

export function cliResultSummary(result, context) {
  return [
    context ? `context: ${context}` : undefined,
    `exitCode: ${result.exitCode ?? "<none>"}`,
    `signal: ${result.signal ?? "<none>"}`,
    result.stdout ? `stdout:\n${result.stdout}` : "stdout: <empty>",
    result.stderr ? `stderr:\n${result.stderr}` : "stderr: <empty>",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function findFiles(root, basename, withinCandidate = false) {
  const matches = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return matches;
    }
    throw error;
  }

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const shouldDescend = withinCandidate || entry.name.startsWith("smoque-");
      if (shouldDescend) {
        matches.push(...(await findFiles(path, basename, true)));
      }
    } else if (entry.name === basename) {
      matches.push(path);
    }
  }

  return matches;
}

function terminateCliProcess(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (error?.code === "ESRCH") {
        return;
      }
    }
  }

  child.kill(signal);
}

function formatCliCommand(args) {
  return ["smoque", ...args].map((arg) => JSON.stringify(arg)).join(" ");
}
