# Automation

smoque uses the same smoke files locally and in CI. Selection, output, and failure evidence are command options rather than separate test code.

## Select the Proof

Run a directory, one smoke file, or a path fragment:

```sh
npx smoque list smoke/
npx smoque run smoke/ --tag package
npx smoque run smoke/ --skip-tag docker
```

`list` applies the same path and tag selection as `run`, so a pipeline can show exactly what it will execute.

## Reports

The terminal reporter is always human-readable. Add machine output as needed:

```sh
npx smoque run smoke/ --json smoke-results.json
npx smoque run smoke/ --junit smoke-results.xml
npx smoque run smoke/ --ci
```

`--ci` adds GitHub Actions error annotations and retains failed workdirs. JSON and JUnit output provide machine-readable run results.

Use `--keep-workdir-on-fail` to preserve managed workdirs for diagnosis. Snapshot changes remain explicit through `--update-snapshots`.

## Documentation Snippets

Mark a TypeScript or JavaScript smoke fence with `smoque`, then verify it:

````md
```ts smoque
import { smoke } from "smoque";

smoke.suite("documented example", async (t) => {
  await t.log("the example runs");
});
```
````

```sh
npx smoque snippets README.md --timeout 30s
```

The command discovers marked snippets in a file or directory, runs each in isolation, and reports the source location.

## Agent Conventions

```sh
npx smoque agents init
```

This adds a short local convention file that tells coding agents where smoke tests live and how to use the runner safely. It does not replace project-specific instructions.

## CI Shape

A useful pipeline keeps the proof narrow:

```sh
npm ci
npx smoque doctor
npx smoque run smoke/ --ci --junit smoke-results.xml
```

Upload `smoke-results.xml` and any retained artifact directory only on failure. Keep external services explicit; use fake HTTP servers for boundaries you own and Compose or Postgres only when the real integration is the point of the test.
