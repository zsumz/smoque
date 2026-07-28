# Authoring Smoke Tests

A smoque test should prove one important path through the real project. Keep the setup explicit, use steps to explain the proof, and let the runner own temporary resources.

## Suites and Steps

```ts
import { smoke } from "smoque";

smoke.suite("release artifact works", { tags: ["package"] }, async (t) => {
  const root = t.repoRoot();

  await t.step("build", async () => {
    await t.cmd("npm", ["run", "build"], { cwd: root });
  });

  await t.step("exercise artifact", async () => {
    await t.cmd("node", ["dist/my-cli.js", "--version"], { cwd: root });
  });
});
```

Use `t.cmd(command, args)` when arguments are known. `t.sh(script)` is available for a genuinely shell-shaped operation.

## Paths and Fixtures

- `t.repoRoot()` is the project root.
- `t.tempDir()` creates an automatically cleaned temporary directory.
- `t.workDir()` manages a directory inside an allowed boundary and can preserve it on failure.
- `t.fixture.fromTemplate()` copies a template and replaces tokens.
- `t.fs` provides safe copy, remove, read, write, create, and readiness operations.

## Processes and Readiness

`t.process.start()` and `t.process.group()` register managed resources with the runner. They are stopped during cleanup even when a step fails.

Readiness is explicit:

```ts
const port = await t.ports.reserve("api");
const process = await t.process.start("npm", ["run", "dev"], {
  env: t.ports.env({ PORT: port }),
  ready: t.http.ready(`${port.url()}/health`),
  timeout: "20s",
});
```

File, TCP, HTTP, process-output, and custom probes all use the same polling lifecycle.

## Assertions and Evidence

Use `expect` for values, command output, files, file sets, archives, text snapshots, JSON paths, and directory snapshots. Attach useful failure evidence with `t.attach.file()`, `t.attach.dir()`, or `t.attach.text()`.

Secrets registered with `t.redact()` are removed from commands, errors, logs, reports, and attached text. Use `t.net.policy({ external: "block" })` when a smoke test should only reach local or explicitly allowed hosts.

## Cleanup

Prefer managed resources and workdirs. For anything else, register `t.cleanup()` immediately after acquisition. Cleanup runs after success, failure, or skip.

See the runnable [HTTP service](../examples/runnable/http-service.smoke.ts), [process group](../examples/runnable/process-group.smoke.ts), and [release artifact](../examples/runnable/release-artifact.smoke.ts) examples.
